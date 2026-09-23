import SwiftUI

struct PrimaryButton: View {
    let title: String
    var isLoading = false
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.small) {
                if isLoading {
                    ProgressView().tint(.black)
                }
                Text(title).fontWeight(.bold)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 54)
            .foregroundStyle(.black)
            .background(Theme.accent.opacity(isDisabled ? 0.45 : 1), in: RoundedRectangle(cornerRadius: 16))
        }
        .disabled(isDisabled || isLoading)
        .accessibilityLabel(isLoading ? "\(title), loading" : title)
    }
}

struct SurfaceCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(Spacing.large)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22))
            .overlay {
                RoundedRectangle(cornerRadius: 22)
                    .stroke(.white.opacity(0.07), lineWidth: 1)
            }
    }
}

struct AvatarView: View {
    let url: URL?
    let displayName: String
    var size: CGFloat = 64

    var body: some View {
        AsyncImage(url: url) { phase in
            if case let .success(image) = phase {
                image.resizable().scaledToFill()
            } else {
                ZStack {
                    Theme.secondarySurface
                    Text(displayName.prefix(1).uppercased())
                        .font(.system(size: size * 0.4, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay { Circle().stroke(.white.opacity(0.12), lineWidth: 1) }
        .accessibilityLabel("\(displayName)'s profile photo")
    }
}

struct VerificationBadge: View {
    let type: PostingProfile.VerificationType?

    private var color: Color {
        switch type {
        case .organization: Color(red: 0.94, green: 0.73, blue: 0.13)
        case .government: Color(red: 0.72, green: 0.75, blue: 0.79)
        case .individual, .none: Color(red: 0.12, green: 0.63, blue: 0.95)
        }
    }

    private var label: String {
        switch type {
        case .organization: "Verified organization"
        case .government: "Verified government account"
        case .individual, .none: "X Premium"
        }
    }

    var body: some View {
        Image(systemName: "checkmark.seal.fill")
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(color)
            .accessibilityLabel(label)
    }
}
