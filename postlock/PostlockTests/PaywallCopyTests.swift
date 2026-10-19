import Testing
@testable import Postlock

struct PaywallCopyTests {
    @Test func ctaNamesTheTrialWhenThereIsOne() {
        #expect(PaywallCopy.ctaTitle(trialPeriod: "3 Days") == "Start 3 Days Free Trial")
    }

    @Test func ctaIsSubscribeWithoutATrial() {
        #expect(PaywallCopy.ctaTitle(trialPeriod: nil) == "Subscribe")
    }

    @Test func disclosureStatesTrialThenPriceAndPeriod() {
        let copy = PaywallCopy.disclosure(price: "$29.99", isAnnual: true, trialPeriod: "1 Week")
        #expect(copy == "1 Week free. billed $29.99 per year")
    }

    @Test func disclosureWithoutTrialStatesPriceAndPeriod() {
        #expect(PaywallCopy.disclosure(price: "$4.99", isAnnual: false, trialPeriod: nil) == "$4.99 per month.")
    }

    @Test func renewalLabelDependsOnTrial() {
        #expect(PaywallCopy.renewalLabel(price: "$4.99", isAnnual: false, hasTrial: true)
            == "Automatically bills after trial unless cancelled.")
        #expect(PaywallCopy.renewalLabel(price: "$29.99", isAnnual: true, hasTrial: false)
            == "Renews automatically at $29.99 per year.")
    }
}
