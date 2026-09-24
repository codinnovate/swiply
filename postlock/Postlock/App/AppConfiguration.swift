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

    /// RevenueCat public SDK key (safe to embed client-side). Set the real value
    /// in project.yml under `settings.configs.*.REVENUECAT_API_KEY` once the
    /// RevenueCat project for Postlock exists.
    static let revenueCatAPIKey: String = {
        guard
            let rawValue = Bundle.main.object(forInfoDictionaryKey: "REVENUECAT_API_KEY") as? String,
            !rawValue.isEmpty,
            !rawValue.hasPrefix("REPLACE_ME")
        else {
            preconditionFailure("REVENUECAT_API_KEY must be set in Info.plist to a real RevenueCat public API key")
        }
        return rawValue
    }()
}

enum SubscriptionPlan {
    static let entitlementID = "pro"
    static let monthlyProductID = "com.swiply.postlock.pro.monthly"
    static let yearlyProductID = "com.swiply.postlock.pro.yearly"
    static let termsURL = URL(string: "https://postlock.app/terms")!
    static let privacyURL = URL(string: "https://postlock.app/privacy")!
}
