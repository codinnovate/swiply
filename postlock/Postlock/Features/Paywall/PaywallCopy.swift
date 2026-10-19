import Foundation

/// Purchase copy shown on the paywall, kept free of RevenueCat types so it can be tested.
enum PaywallCopy {
    static func billingPeriod(isAnnual: Bool) -> String {
        isAnnual ? "year" : "month"
    }

    static func periodLabel(value: Int, unit: String) -> String {
        "\(value) \(unit)"
    }

    static func ctaTitle(trialPeriod: String?) -> String {
        guard let trialPeriod else { return "Subscribe" }
        return "Start \(trialPeriod) Free Trial"
    }

    static func disclosure(price: String, isAnnual: Bool, trialPeriod: String?) -> String {
        let period = billingPeriod(isAnnual: isAnnual)
        if let trialPeriod {
            return "\(trialPeriod) free. billed \(price) per \(period)"
        }
        return "\(price) per \(period)."
    }

    static func renewalLabel(price: String, isAnnual: Bool, hasTrial: Bool) -> String {
        if hasTrial {
            return "Automatically bills after trial unless cancelled."
        }
        return "Renews automatically at \(price) per \(billingPeriod(isAnnual: isAnnual))."
    }
}
