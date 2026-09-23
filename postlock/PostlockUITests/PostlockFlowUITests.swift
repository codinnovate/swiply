import XCTest

final class PostlockFlowUITests: XCTestCase {
    @MainActor
    func testScheduleCreationReachesTodayDashboard() throws {
        let app = XCUIApplication()
        app.launchEnvironment["POSTLOCK_UI_TEST_SCENARIO"] = "schedule"
        app.launch()

        XCTAssertTrue(app.staticTexts["How often do you want to post?"].waitForExistence(timeout: 3))
        app.buttons["2×"].tap()
        app.buttons["Continue"].tap()
        XCTAssertTrue(app.staticTexts["Allow app blocking"].waitForExistence(timeout: 2))
        app.buttons["Continue in Simulator"].tap()
        XCTAssertTrue(app.staticTexts["What gets locked?"].waitForExistence(timeout: 2))
        app.buttons["Lock These Apps"].tap()

        XCTAssertTrue(app.navigationBars["Today"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["0 of 2 posts verified"].exists)
    }

    @MainActor
    func testSimulatedMissAndVerificationToggleLockState() throws {
        let app = XCUIApplication()
        app.launchEnvironment["POSTLOCK_UI_TEST_SCENARIO"] = "dashboard"
        app.launch()

        app.tabBars.buttons["Settings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 3))
        revealAndTap("Simulate missed deadline", in: app)

        app.tabBars.buttons["Today"].tap()
        XCTAssertTrue(app.staticTexts["APPS LOCKED"].waitForExistence(timeout: 2))

        app.tabBars.buttons["Settings"].tap()
        revealAndTap("Simulate verification success", in: app)
        app.tabBars.buttons["Today"].tap()
        XCTAssertFalse(app.staticTexts["APPS LOCKED"].exists)
        XCTAssertTrue(app.staticTexts["3 of 3 posts verified"].exists)
    }

    @MainActor
    private func revealAndTap(_ label: String, in app: XCUIApplication) {
        let button = app.buttons[label]
        for _ in 0 ..< 4 where !button.exists {
            app.swipeUp()
        }
        XCTAssertTrue(button.exists, "Expected to find \(label)")
        button.tap()
    }
}
