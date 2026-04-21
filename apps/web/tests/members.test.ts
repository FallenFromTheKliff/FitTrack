import { test, expect } from '@playwright/test';

test('load members page', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', exp => console.log('BROWSER EXCEPTION:', exp));

    await page.goto('http://localhost:8080/login');
    await page.fill('input[type="email"]', 'seed.admin@fittrack.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('http://localhost:8080/dashboard');

    // Now navigate or click to members
    await page.goto('http://localhost:8080/members');

    await page.waitForLoadState('networkidle');

    const errorLoc = page.locator('text=Application error');
    if (await errorLoc.isVisible().catch(() => false)) {
        console.log("REACT CRASHED WITH APPLICATION ERROR");
    }

    const table = page.locator('.members-content-grid');
    console.log("TABLE VISIBLE: ", await table.isVisible());

    const html = await page.content();
    require('fs').writeFileSync('dom.html', html);
});