import Foundation

enum AppBrand {
    static let name = "POSTLOCK"
    static let tagline = "Post first. Scroll later."
    static let supportEmail = "support@postlock.app"
}

enum AppConfiguration {
    static let apiBaseURL: URL = {
        guard
            let rawValue = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
            let url = URL(string: rawValue)
        else {
            preconditionFailure("API_BASE_URL must be a valid URL in Info.plist")
        }
        return url
    }()
}
