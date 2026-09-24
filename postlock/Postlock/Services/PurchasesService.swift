import Foundation
import Observation
import RevenueCat

/// Wraps the RevenueCat SDK and exposes Postlock Pro subscription state to the
/// rest of the app as a simple, observable `isPro` flag.
@MainActor
@Observable
final class PurchasesService: NSObject {
    private(set) var isPro = false
    private(set) var offerings: Offerings?
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private var didConfigure = false

    func configure() {
        guard !didConfigure else { return }
        didConfigure = true

        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: AppConfiguration.revenueCatAPIKey)
        Purchases.shared.delegate = self

        Task { await refreshCustomerInfo() }
        Task { await loadOfferings() }
    }

    func loadOfferings() async {
        isLoading = true
        defer { isLoading = false }
        do {
            offerings = try await Purchases.shared.offerings()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refreshCustomerInfo() async {
        do {
            let info = try await Purchases.shared.customerInfo()
            apply(info)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Returns true if the purchase completed and unlocked Pro.
    @discardableResult
    func purchase(_ package: Package) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let result = try await Purchases.shared.purchase(package: package)
            if result.userCancelled { return false }
            apply(result.customerInfo)
            return isPro
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    @discardableResult
    func restorePurchases() async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let info = try await Purchases.shared.restorePurchases()
            apply(info)
            return isPro
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func apply(_ info: CustomerInfo) {
        isPro = info.entitlements[SubscriptionPlan.entitlementID]?.isActive == true
    }
}

extension PurchasesService: @preconcurrency PurchasesDelegate {
    func purchases(_ purchases: Purchases, receivedUpdated customerInfo: CustomerInfo) {
        apply(customerInfo)
    }
}
