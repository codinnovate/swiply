import Testing
@testable import Postlock

struct PaywallCopyTests {
    @Test func ctaNeverMentionsTheTrial() {
        #expect(PaywallCopy.ctaTitle == "Continue")
    }

    @Test func billedAmountStatesPriceAndPeriod() {
        #expect(PaywallCopy.billedAmount(price: "$29.99", isAnnual: true) == "$29.99 / year")
        #expect(PaywallCopy.billedAmount(price: "$4.99", isAnnual: false) == "$4.99 / month")
    }

    @Test func termsLeadWithTheBilledAmountBeforeTheTrial() {
        let copy = PaywallCopy.terms(price: "$29.99", isAnnual: true, trialPeriod: "1 Week")
        #expect(copy == "Billed $29.99 per year after a 1 week free trial. Renews automatically unless cancelled.")
    }

    @Test func termsWithoutTrialStatePriceAndRenewal() {
        #expect(PaywallCopy.terms(price: "$4.99", isAnnual: false, trialPeriod: nil)
            == "Billed $4.99 per month. Renews automatically unless cancelled.")
    }
}
