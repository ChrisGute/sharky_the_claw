import { expect, test } from '@playwright/test';

test.describe('runtime invariants', () => {
  test('renders real character art and keeps the live HUD stable through sound changes', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
    await expect(page.getByRole('heading', { name: /Sharky/ })).toBeVisible();
    await page.getByRole('button', { name: 'Dive in' }).click();
    await page.getByRole('button', { name: 'Sunny Lagoon' }).click();
    await page.getByRole('button', { name: 'Start dive' }).click();
    await page.waitForTimeout(2400);

    const art = await page.evaluate(() => window.__sharkyTest?.state());
    expect(art.sharkType).toBe('Image');
    expect(art.sharkTexture).toBe('shark');
    expect(art.activeFish).toBeGreaterThanOrEqual(15);
    expect(art.fishTextures.every((texture) => texture?.startsWith('fish-'))).toBe(true);

    const authoredArt = await page.evaluate(() => window.__sharkyTest?.artProbe());
    expect(authoredArt.shark).toEqual({ width: 190, height: 118 });
    expect(Object.keys(authoredArt.fish)).toHaveLength(7);
    for (const dimensions of Object.values(authoredArt.fish)) {
      expect(dimensions.width).toBeGreaterThanOrEqual(68);
      expect(dimensions.height).toBeGreaterThanOrEqual(38);
    }

    const animation = await page.evaluate(() => window.__sharkyTest?.animationProbe());
    expect(animation.sharkLater.x).not.toBeCloseTo(animation.sharkStart.x, 5);
    expect(animation.sharkLater.y).not.toBeCloseTo(animation.sharkStart.y, 5);
    expect(animation.fishLater).not.toBeCloseTo(animation.fishStart, 5);

    await page.evaluate(() => window.__sharkyTest?.collide('minnow'));
    await expect(page.getByTestId('score')).toHaveText('1');
    await page.evaluate(() => window.__sharkyTest?.advance(3100));
    const roundBeforeMute = await page.evaluate(() => window.__sharkyTest?.state().round);
    await page.evaluate(() =>
      Reflect.set(window, '__timerIdentity', document.querySelector('[data-testid="timer"]')),
    );
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await expect(page.getByTestId('score')).toHaveText('1');
    const roundAfterMute = await page.evaluate(() => window.__sharkyTest?.state().round);
    expect(roundAfterMute.phase).toBe('active');
    expect(roundAfterMute.remainingMs).toBeLessThanOrEqual(roundBeforeMute.remainingMs);
    expect(roundAfterMute.remainingMs).toBeGreaterThan(roundBeforeMute.remainingMs - 1000);
    expect(
      await page.evaluate(
        () =>
          Reflect.get(window, '__timerIdentity') ===
          document.querySelector('[data-testid="timer"]'),
      ),
    ).toBe(true);
  });

  test('pause freezes time and settlement banks exactly once', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
    await expect.poll(() => page.evaluate(() => Boolean(window.__sharkyTest))).toBe(true);
    await page.evaluate(() => window.__sharkyTest?.start());
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__sharkyTest?.pause());
    const before = await page.evaluate(() => window.__sharkyTest?.state().round.remainingMs);
    await page.evaluate(() => window.__sharkyTest?.advance(5000));
    expect(await page.evaluate(() => window.__sharkyTest?.state().round.remainingMs)).toBe(before);
    await page.evaluate(() => window.__sharkyTest?.resume());
    await page.evaluate(() => window.__sharkyTest?.advance(20000));
    await expect(page.getByRole('heading', { name: 'Fin-tastic!' })).toBeVisible();
    const revision = await page.evaluate(() => window.__sharkyTest?.state().round.settled);
    expect(revision).toBe(true);
  });

  test('boost follows ready active cooldown ready', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.__sharkyTest?.grant(25);
      window.__sharkyTest?.buy('boost');
      window.__sharkyTest?.start();
    });
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => window.__sharkyTest?.state().boostState)).toBe('READY');
    await page.evaluate(() => window.__sharkyTest?.boost());
    expect(await page.evaluate(() => window.__sharkyTest?.state().boostState)).toBe('ACTIVE');
    await page.evaluate(() => window.__sharkyTest?.advance(1000));
    expect(await page.evaluate(() => window.__sharkyTest?.state().boostState)).toBe('COOLDOWN');
    await page.evaluate(() => window.__sharkyTest?.advance(5000));
    expect(await page.evaluate(() => window.__sharkyTest?.state().boostState)).toBe('READY');
  });

  test('results replay clears the results panel and starts a fresh round', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
    await page.evaluate(() => window.__sharkyTest?.startActive());
    await expect
      .poll(() => page.evaluate(() => window.__sharkyTest?.state().round?.phase))
      .toBe('active');
    await page.evaluate(() => window.__sharkyTest?.advance(20_000));
    await expect(page.getByRole('heading', { name: 'Fin-tastic!' })).toBeVisible();
    await page.getByRole('button', { name: 'Dive again' }).click();
    await expect(page.getByRole('heading', { name: 'Fin-tastic!' })).toBeHidden();
    await expect(page.getByTestId('score')).toHaveText('0');
    expect(await page.evaluate(() => window.__sharkyTest?.state().round.phase)).toBe('ready');
  });

  test('music resumes on replay after the old scene shuts down', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
    await page.getByRole('button', { name: 'Dive in' }).click();
    await page.getByRole('button', { name: 'Sunny Lagoon' }).click();
    await page.getByRole('button', { name: 'Start dive' }).click();
    await page.waitForTimeout(2400);
    await page.evaluate(() => window.__sharkyTest?.advance(20_000));
    await page.getByRole('button', { name: 'Dive again' }).click();
    await expect
      .poll(() => page.evaluate(() => window.__sharkyTest?.state().round?.phase))
      .toBe('active');
    await expect
      .poll(() => page.evaluate(() => window.__sharkyTest?.state().audio))
      .toMatchObject({ paused: false, musicActive: true, contextState: 'running' });
  });

  test('fish turn inward at walls and the population recovers after rapid catches', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
    await page.evaluate(() => window.__sharkyTest?.startActive());
    await expect
      .poll(() => page.evaluate(() => window.__sharkyTest?.state().round?.phase))
      .toBe('active');

    const edge = await page.evaluate(() => window.__sharkyTest?.edgeProbe());
    expect(edge.x).toBeGreaterThanOrEqual(edge.minimumX);
    expect(edge.velocityX).toBeGreaterThan(0);

    const directions = await page.evaluate(() => window.__sharkyTest?.directionProbe());
    expect(directions.right).toEqual({ velocityX: expect.any(Number), flipped: false });
    expect(directions.right.velocityX).toBeGreaterThan(0);
    expect(directions.left).toEqual({ velocityX: expect.any(Number), flipped: true });
    expect(directions.left.velocityX).toBeLessThan(0);

    const sharkHeading = await page.evaluate(() => window.__sharkyTest?.sharkHeadingProbe());
    expect(sharkHeading.rightDown.flipped).toBe(false);
    expect(sharkHeading.rightDown.rotation).toBeGreaterThan(0.1);
    expect(sharkHeading.rightUp.flipped).toBe(false);
    expect(sharkHeading.rightUp.rotation).toBeLessThan(-0.1);
    expect(sharkHeading.leftDown.flipped).toBe(true);
    expect(sharkHeading.leftDown.rotation).toBeLessThan(-0.1);
    expect(sharkHeading.leftUp.flipped).toBe(true);
    expect(sharkHeading.leftUp.rotation).toBeGreaterThan(0.1);

    const stun = await page.evaluate(() => window.__sharkyTest?.stunProbe());
    expect(stun.initial).toBeCloseTo(1000, 5);
    expect(stun.beforeExpiry).toBeCloseTo(1, 5);
    expect(stun.afterExpiry).toBe(0);

    const consumed = await page.evaluate(() => window.__sharkyTest?.consumeExisting(7));
    expect(consumed).toBeGreaterThanOrEqual(5);
    expect(await page.evaluate(() => window.__sharkyTest?.state().activeFish)).toBeLessThan(15);
    for (let step = 0; step < 8; step += 1)
      await page.evaluate(() => window.__sharkyTest?.advance(350));
    expect(
      await page.evaluate(() => window.__sharkyTest?.state().activeFish),
    ).toBeGreaterThanOrEqual(15);
  });
});
