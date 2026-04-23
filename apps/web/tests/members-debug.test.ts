import { test } from '@playwright/test';

test('debug members page', async ({ page }) => {
    const logs = [];
    page.on('console', msg => logs.push('LOG: ' + msg.text()));
    page.on('pageerror', exp => logs.push('ERROR: ' + exp.message));
    page.on('requestfailed', req => logs.push('FAILED: ' + req.url()));
    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/v1/admin/users') || url.includes('/v1/staff/users') || url.includes('/v1/staff/coaches')) {
            logs.push(`API: ${res.status()} ${url}`);
            if (res.status() >= 400) {
                try {
                    const body = await res.text();
                    logs.push(`API BODY: ${body.slice(0, 500)}`);
                } catch (_err) {
                    logs.push('API BODY: <unavailable>');
                }
            }
        }
    });

    try {
        await page.goto('http://localhost:8080/login');

        await page.fill('input[type="email"]', 'seed.admin@fittrack.com');
        await page.fill('input[type="password"]', 'SeedAdmin!2026');
        await page.waitForTimeout(1000);

        await page.getByRole('button', { name: /sign in/i }).click();

        try { await page.waitForURL('**/dashboard', { timeout: 10000 }); } catch (_e: unknown) { }
        await page.screenshot({ path: 'dashboard.png', fullPage: true });

        await page.goto('http://localhost:8080/members');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'members.png', fullPage: true });

        const tableCount = await page.locator('table').count();
        const rowCount = await page.locator('tr.fit-table-row').count();
        const directoryCount = await page.locator('text=Account directory').count();
        const visibleRecordCount = await page.locator('text=/records visible/i').count();
        logs.push(`DOM: tableCount=${tableCount}`);
        logs.push(`DOM: rowCount=${rowCount}`);
        logs.push(`DOM: membersDirectoryCount=${directoryCount}`);
        logs.push(`DOM: visibleRecordLabelCount=${visibleRecordCount}`);

        if (tableCount > 0) {
            const tableBox = await page.locator('table').first().boundingBox();
            logs.push(`DOM: firstTableBox=${JSON.stringify(tableBox)}`);
        }

        const sectionText = await page.locator('.members-content-grid').first().innerText().catch(() => '<missing members-content-grid>');
        logs.push(`DOM: members-content-grid text preview: ${sectionText.slice(0, 600)}`);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logs.push('SCRIPT EXCEPTION: ' + message);
    }

    require('fs').writeFileSync('debug_logs.txt', logs.join('\n'));
});
