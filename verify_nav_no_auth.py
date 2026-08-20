from playwright.sync_api import sync_playwright
import time

def verify_nav():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 400, 'height': 800},
            record_video_dir='/home/jules/verification/videos'
        )
        page = context.new_page()

        # Just go to the root, maybe the login isn't required or uses a different placeholder
        page.goto('http://localhost:5173/')

        # wait a bit to see if there's a login form or we are already loaded
        page.wait_for_timeout(3000)

        # Login logic if there's an email input
        email_input = page.locator('input[type="email"]')
        if email_input.count() > 0:
            email_input.first.fill('test@example.com')
            page.locator('input[type="password"]').first.fill('password123')
            page.locator('button:has-text("Sign In"), button:has-text("Login")').first.click()
            page.wait_for_timeout(3000)

        # Or if it's the specific placeholder
        elif page.locator('input[placeholder="Enter your email"]').count() > 0:
            page.locator('input[placeholder="Enter your email"]').first.fill('test@example.com')
            page.locator('input[placeholder="Password"]').first.fill('password123')
            page.locator('button:has-text("Sign In")').first.click()
            page.wait_for_timeout(3000)

        # Let's check for "Log in" or something
        elif page.locator('text="Get Started"').count() > 0:
            page.locator('text="Get Started"').first.click()
            page.wait_for_timeout(2000)

        # Click multiple tabs to see the animation
        tabs_to_click = ["HOME", "MCQ", "REVISION", "STORE", "PROFILE"]

        for tab_name in tabs_to_click:
            try:
                print(f"Clicking tab: {tab_name}")
                # We need to find the tab button containing this text in the bottom nav
                # The labels are inside span.text-[10px] inside the tab buttons
                tab = page.locator(f'nav[data-iic-bottom-nav] button:has(span:text-is("{tab_name}"))')
                if tab.count() > 0:
                    tab.first.click()
                    page.wait_for_timeout(1000)
                else:
                    print(f"Tab {tab_name} not found")
            except Exception as e:
                print(f"Error clicking {tab_name}: {e}")

        # Wait for the last animation to finish
        page.wait_for_timeout(1500)

        # Let the video finalize
        context.close()
        browser.close()

if __name__ == '__main__':
    verify_nav()
