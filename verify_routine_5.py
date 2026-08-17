from playwright.sync_api import sync_playwright
import time

def verify_routine_page():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        page.goto('http://localhost:5173')
        time.sleep(2)

        # Inject mock user
        page.evaluate('''
            const user = {id: "user123", name: "Test User", role: "STUDENT", subscriptionLevel: "FREE", score: 0};
            window.localStorage.setItem('iic_user', JSON.stringify(user));

            // Set mock routine data with an active task
            const mockRoutine = {
                active: true,
                routineCategories: [
                    {
                        id: "cat1",
                        categoryName: "Core Studies",
                        emoji: "📚",
                        currentSubjectIndex: 0,
                        subjects: [
                            { subjectId: "science", bookName: "", classLevel: "" }
                        ]
                    }
                ]
            };
            window.localStorage.setItem('iic_routine_data_user123', JSON.stringify(mockRoutine));

            // Mock a lucent note so it resolves
            const mockNotes = [{
                id: "lesson1",
                subject: "science",
                lessonTitle: "Test Science Lesson",
                pages: [ { text: "This is some test content. One two three four five. " } ] // Short content so required time is minimal
            }];
            window.localStorage.setItem('iic_lucent_notes', JSON.stringify(mockNotes));

            // Dispatch event to re-render
            window.dispatchEvent(new Event('storage'));
        ''')

        page.reload()
        time.sleep(2)

        # Navigate to Routine page
        page.evaluate('''
            const evt = new CustomEvent("open-app-tab", { detail: "ROUTINE" });
            window.dispatchEvent(evt);
        ''')
        time.sleep(2)

        page.screenshot(path='/home/jules/verification/routine_card_timer.png', full_page=True)

        browser.close()

verify_routine_page()
