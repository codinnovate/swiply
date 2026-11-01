import Foundation

/// Purchase copy shown on the paywall, kept free of RevenueCat types so it can be tested.
///
/// App Review (3.1.2(c)) requires the billed amount to be the most conspicuous pricing
/// element, so the trial only ever appears in the subordinate `terms` line and never in
/// the button or the price itself.
enum PaywallCopy {
    static let ctaTitle = "Continue"

    static func billingPeriod(isAnnual: Bool) -> String {
        isAnnual ? "year" : "month"
    }

    /// The billed amount, e.g. "$29.99 / year". Shown as the largest pricing text.
    static func billedAmount(price: String, isAnnual: Bool) -> String {
        "\(price) / \(billingPeriod(isAnnual: isAnnual))"
    }

    /// Subordinate terms shown in small text under the billed amount.
    static func terms(price: String, isAnnual: Bool, trialPeriod: String?) -> String {
        let period = billingPeriod(isAnnual: isAnnual)
        guard let trialPeriod else {
            return "Billed \(price) per \(period). Renews automatically unless cancelled."
        }
        return "Billed \(price) per \(period) after a \(trialPeriod.lowercased()) free trial. "
            + "Renews automatically unless cancelled."
    }
}
