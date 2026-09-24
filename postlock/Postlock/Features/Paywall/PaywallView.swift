import SwiftUI
import RevenueCat

struct PaywallView: View {
    @Environment(PurchasesService.self) private var purchases
    @State private var selectedPackage: Package?
    @State private var isPurchasing = false
    @State private var isRestoring = false

    private var currentOffering: Offering? { purchases.offerings?.current }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.extraLarge) {
                header

                if let offering = currentOffering, !offering.availablePackages.isEmpty {
                    VStack(spacing: Spacing.medium) {
                        ForEach(offering.availablePackages, id: \.identifier) { package in
                            PlanCard(
                                package: package,
                                isSelected: selectedPackage?.identifier == package.identifier
                            )
                            .onTapGesture { selectedPackage = package }
                        }
                    }
                    .task(id: offering.identifier) {
                        if selectedPackage == nil {
                            selectedPackage = offering.availablePackages.first { $0.packageType == .annual }
                                ?? offering.availablePackages.first
                        }
                    }
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 160)
                }

                if let errorMessage = purchases.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(Theme.danger)
                        .multilineTextAlignment(.center)
                }

                PrimaryButton(
                    title: ctaTitle,
                    isLoading: isPurchasing,
                    isDisabled: selectedPackage == nil
                ) {
                    Task { await purchase() }
                }

                Button {
                    Task { await restore() }
                } label: {
                    if isRestoring {
                        ProgressView().tint(Theme.secondaryText)
                    } else {
                        Text("Restore Purchases")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
                .disabled(isRestoring)

                HStack(spacing: Spacing.medium) {
                    Link("Terms of Use", destination: SubscriptionPlan.termsURL)
                    Text("·").foregroundStyle(Theme.secondaryText)
                    Link("Privacy Policy", destination: SubscriptionPlan.privacyURL)
                }
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
            }
            .padding(Spacing.large)
        }
        .background(Theme.background.ignoresSafeArea())
        .task { if currentOffering == nil { await purchases.loadOfferings() } }
    }

    private var header: some View {
        VStack(spacing: Spacing.small) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 40))
                .foregroundStyle(Theme.accent)
                .padding(.top, Spacing.huge)
            Text("Unlock Postlock Pro")
                .font(.title2.bold())
                .foregroundStyle(.white)
            Text("Full posting protection: your goals, your schedule, enforced.")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
                .multilineTextAlignment(.center)
        }
    }

    private var ctaTitle: String {
        guard let selectedPackage else { return "Continue" }
        let hasTrial = selectedPackage.storeProduct.introductoryDiscount?.paymentMode == .freeTrial
        return hasTrial ? "Start 3-Day Free Trial" : "Subscribe"
    }

    private func purchase() async {
        guard let selectedPackage, !isPurchasing else { return }
        isPurchasing = true
        defer { isPurchasing = false }
        await purchases.purchase(selectedPackage)
    }

    private func restore() async {
        guard !isRestoring else { return }
        isRestoring = true
        defer { isRestoring = false }
        await purchases.restorePurchases()
    }
}

private struct PlanCard: View {
    let package: Package
    let isSelected: Bool

    private var hasTrial: Bool {
        package.storeProduct.introductoryDiscount?.paymentMode == .freeTrial
    }

    private var isAnnual: Bool { package.packageType == .annual }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: Spacing.small) {
                    Text(isAnnual ? "Yearly" : "Monthly")
                        .font(.headline)
                        .foregroundStyle(.white)
                    if isAnnual {
                        Text("BEST VALUE")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Theme.accent, in: Capsule())
                            .foregroundStyle(.black)
                    }
                }
                Text(hasTrial ? "3-day free trial, then \(package.storeProduct.localizedPriceString)" : package.storeProduct.localizedPriceString)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
            }
            Spacer()
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 22))
                .foregroundStyle(isSelected ? Theme.accent : Theme.secondaryText)
        }
        .padding(Spacing.large)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
        .overlay {
            RoundedRectangle(cornerRadius: 18)
                .stroke(isSelected ? Theme.accent : .white.opacity(0.07), lineWidth: isSelected ? 2 : 1)
        }
        .contentShape(Rectangle())
    }
}
