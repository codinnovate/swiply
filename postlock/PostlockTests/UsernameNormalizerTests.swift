import Testing
@testable import Postlock

struct UsernameNormalizerTests {
    @Test(arguments: [
        ("samuel", "samuel"),
        ("@Samuel", "samuel"),
        ("  @samuel  ", "samuel"),
        ("https://x.com/Samuel/", "samuel"),
        ("https://www.x.com/samuel", "samuel"),
        ("x.com/samuel/", "samuel"),
        ("name_123", "name_123")
    ])
    func normalizesValidInput(input: String, expected: String) throws {
        #expect(try UsernameNormalizer.normalize(input) == expected)
    }

    @Test(arguments: [
        "",
        "@",
        "two words",
        "https://example.com/samuel",
        "https://x.com/samuel/status/1",
        "this_username_is_far_too_long"
    ])
    func rejectsInvalidInput(input: String) {
        #expect(throws: (any Error).self) {
            try UsernameNormalizer.normalize(input)
        }
    }
}
