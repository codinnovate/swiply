import SwiftUI

enum UsernameSetupMode {
    case onboarding
    case change
}

struct UsernameSetupView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let mode: UsernameSetupMode

    @State private var viewModel: UsernameSetupViewModel?
    @FocusState private var usernameIsFocused: Bool

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            if let viewModel {
                content(viewModel)
                    .animation(.easeInOut(duration: 0.25), value: viewModel.state)
            }
        }
        .toolbar {
            if mode == .change {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .task {
            guard viewModel == nil else { return }
            viewModel = UsernameSetupViewModel(client: session.profileClient)
        }
    }

    @ViewBuilder
    private func content(_ viewModel: UsernameSetupViewModel) -> some View {
        switch viewModel.state {
        case .entry, .loading:
            entryView(viewModel)
        case let .confirmation(profile):
            confirmationView(profile, viewModel: viewModel)
        case .protectedAccount:
            protectedAccountView(viewModel)
        }
    }

    private func entryView(_ viewModel: UsernameSetupViewModel) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.extraLarge) {
                brandMark
                    .padding(.bottom, Spacing.huge)

                VStack(alignment: .leading, spacing: Spacing.medium) {
                    Text("Which X account are you growing?")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("Tell us where you post. Postlock will keep you showing up.")
                        .font(.title3)
                        .foregroundStyle(Theme.secondaryText)
                }

                VStack(alignment: .leading, spacing: Spacing.small) {
                    HStack(spacing: 4) {
                        Text("@")
                            .foregroundStyle(Theme.secondaryText)
                        TextField("username", text: Bindable(viewModel).rawUsername)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .submitLabel(.continue)
                            .focused($usernameIsFocused)
                            .onSubmit { submit(viewModel) }
                    }
                    .font(.title3.weight(.semibold))
                    .padding(.horizontal, Spacing.large)
                    .frame(minHeight: 58)
                    .background(Theme.secondarySurface, in: RoundedRectangle(cornerRadius: 16))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(viewModel.errorMessage == nil ? .white.opacity(0.1) : Theme.danger, lineWidth: 1)
                    }

                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Theme.danger)
                            .accessibilityLabel("Error: \(errorMessage)")
                    }
                }

                PrimaryButton(
                    title: "Continue",
                    isLoading: viewModel.isLoading,
                    isDisabled: !viewModel.canSubmit
                ) { submit(viewModel) }

                privacyCopy
                    .padding(.top, Spacing.small)
            }
            .padding(Spacing.extraLarge)
            .frame(maxWidth: 620)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear { usernameIsFocused = true }
    }

    private func confirmationView(_ profile: PostingProfile, viewModel: UsernameSetupViewModel) -> some View {
        VStack(spacing: Spacing.extraLarge) {
            Spacer()

            Text("Is this the account you want to grow?")
                .font(.system(size: 36, weight: .bold, design: .rounded))

            SurfaceCard {
                HStack(spacing: Spacing.large) {
                    AvatarView(url: profile.avatarURL, displayName: profile.displayName, size: 72)
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 6) {
                            Text(profile.displayName)
                                .font(.title2.weight(.bold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            if profile.isVerified == true {
                                VerificationBadge(type: profile.verificationType)
                            }
                        }
                        Text("@\(profile.username)")
                            .font(.body)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            }

            privacyCopy

            Spacer()

            VStack(spacing: Spacing.medium) {
                PrimaryButton(title: "Yes, That's Mine") {
                    session.save(profile)
                    if mode == .change { dismiss() }
                }
                Button("Change Username") { viewModel.changeUsername() }
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                    .frame(minHeight: 44)
            }
        }
        .padding(Spacing.extraLarge)
        .frame(maxWidth: 620)
        .frame(maxWidth: .infinity)
    }

    private func protectedAccountView(_ viewModel: UsernameSetupViewModel) -> some View {
        VStack(spacing: Spacing.extraLarge) {
            Spacer()
            Image(systemName: "eye.slash.fill")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 92, height: 92)
                .background(Theme.surface, in: Circle())

            VStack(spacing: Spacing.medium) {
                Text("Your posts need to be public.")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center)
                Text("Postlock needs to see when you have posted. Make this account public, or choose another one.")
                    .font(.title3)
                    .foregroundStyle(Theme.secondaryText)
                    .multilineTextAlignment(.center)
            }
            Spacer()
            PrimaryButton(title: "Change Username") { viewModel.changeUsername() }
        }
        .padding(Spacing.extraLarge)
        .frame(maxWidth: 620)
        .frame(maxWidth: .infinity)
    }

    private var privacyCopy: some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            Label("We only look at posts anyone can already see.", systemImage: "eye")
            Label("We never post or touch your X account.", systemImage: "lock.shield")
        }
        .font(.footnote)
        .foregroundStyle(Theme.secondaryText)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var brandMark: some View {
        HStack(spacing: Spacing.small) {
            Image("BrandMark")
                .resizable()
                .scaledToFill()
                .frame(width: 32, height: 32)
                .clipShape(RoundedRectangle(cornerRadius: 9))
            Text(AppBrand.name)
                .font(.subheadline.weight(.black))
                .tracking(1.5)
        }
        .accessibilityElement(children: .combine)
    }

    private func submit(_ viewModel: UsernameSetupViewModel) {
        guard viewModel.canSubmit else { return }
        usernameIsFocused = false
        Task { await viewModel.verify() }
    }
}
