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
        XCTAssertTrue(app.staticTexts["Keep X available"].waitForExistence(timeout: 2))
        app.buttons["Block All Other Apps"].tap()

        XCTAssertTrue(app.buttons["checkPosts"].waitForExistence(timeout: 3))
        XCTAssertEqual(app.descendants(matching: .any)["dailyProgress"].label, "0 of 2 posts verified")
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
        XCTAssertTrue(app.staticTexts["Let's catch up."].waitForExistence(timeout: 2))

        app.tabBars.buttons["Settings"].tap()
        revealAndTap("Simulate verification success", in: app)
        app.tabBars.buttons["Today"].tap()
        XCTAssertTrue(app.staticTexts["Daily goal complete"].waitForExistence(timeout: 2))
        XCTAssertEqual(app.descendants(matching: .any)["dailyProgress"].label, "3 of 3 posts verified")
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
