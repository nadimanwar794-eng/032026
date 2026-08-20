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

        # Login logic
        page.goto('http://localhost:5173/')
        page.fill('input[placeholder="Enter your email..."]', 'test@example.com')
        page.fill('input[placeholder="Password"]', 'password123')
        page.click('button:has-text("Sign In")')
        page.wait_for_timeout(3000)

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
