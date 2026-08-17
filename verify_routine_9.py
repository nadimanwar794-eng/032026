from playwright.sync_api import sync_playwright
import time

def verify_routine_page():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        page.goto('http://localhost:5173')
        time.sleep(2)

        # Inject mock user into localforage for auth bypass
        page.evaluate('''
            const user = {"id":"user123", "role":"STUDENT", "name":"Test User", "subscriptionLevel":"FREE"};
            window.localStorage.setItem('iic_user', JSON.stringify(user));

            const dbName = "localforage";
            const req = indexedDB.open(dbName);
            req.onsuccess = function(e) {
                if (e && e.target && e.target.result) {
                    const db = e.target.result;
                    const tx = db.transaction("keyvaluepairs", "readwrite");
                    const store = tx.objectStore("keyvaluepairs");
                    store.put(user, "iic_user_profile");
                }
            };
        ''')
        time.sleep(2)

        # Set mock routine data with an active task
        page.evaluate('''
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

            // Force progress simulation
            window.localStorage.setItem('iic_routine_page_time_lesson1_0', "2");
        ''')

        page.reload()
        time.sleep(4)

        # Navigate to Routine page
        page.evaluate('''
            const evt = new CustomEvent("open-app-tab", { detail: "ROUTINE" });
            window.dispatchEvent(evt);
        ''')
        time.sleep(2)

        page.screenshot(path='/home/jules/verification/routine_card_timer5.png', full_page=True)

        browser.close()

verify_routine_page()
