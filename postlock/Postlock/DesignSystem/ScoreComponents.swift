import SwiftUI

enum ScoreColor {
    /// Red below 20, through amber, to POSTLOCK green at 80 and above.
    static func color(for score: Double) -> Color {
        let progress = (min(max(score, 20), 80) - 20) / 60
        return Color(hue: 0.015 + progress * 0.215, saturation: 0.78, brightness: 0.98)
    }
}

/// The 0–100 virality score as a ring.
struct ScoreBadge: View {
    let score: Double
    var size: CGFloat = 48
    var lineWidth: CGFloat = 5

    var body: some View {
        let color = ScoreColor.color(for: score)
        ZStack {
            Circle().stroke(Theme.secondarySurface, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(max(score, 0), 100) / 100)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text(score.formatted(.number.precision(.fractionLength(0))))
                .font(.system(size: size * 0.36, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Virality score \(Int(score.rounded())) out of 100")
    }
}

/// A placeholder ring while a post is waiting to be scored.
struct PendingScoreBadge: View {
    var failed = false
    var size: CGFloat = 48

    var body: some View {
        ZStack {
            Circle().stroke(Theme.secondarySurface, style: StrokeStyle(lineWidth: 5, dash: [4, 4]))
            if failed {
                Image(systemName: "exclamationmark").font(.headline).foregroundStyle(Theme.secondaryText)
            } else {
                ProgressView().controlSize(.small)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel(failed ? "Scoring failed" : "Scoring")
    }
}

/// One bar per category; risk factors draw as a red, subtractive bar.
struct ScoreBreakdownView: View {
    let score: ViralityScore

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.medium) {
            ForEach(score.orderedCategories, id: \.category) { item in
                CategoryBar(category: item.category, value: item.score)
            }
        }
    }
}

private struct CategoryBar: View {
    let category: ScoreCategory
    let value: CategoryScore

    private var isRisk: Bool { category == .riskFactors }
    private var fraction: Double {
        isRisk
            ? Double(abs(value.score)) / Double(abs(ScoreCategory.riskFloor))
            : Double(value.score) / Double(max(value.max, 1))
    }

    private var tint: Color {
        isRisk ? Theme.danger : ScoreColor.color(for: fraction * 100)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(category.title).font(.subheadline.weight(.semibold))
                Spacer()
                Text(isRisk ? (value.score == 0 ? "None" : "\(value.score)") : "\(value.score)/\(value.max)")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(isRisk && value.score < 0 ? Theme.danger : Theme.secondaryText)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.secondarySurface)
                    Capsule().fill(tint).frame(width: proxy.size.width * min(max(fraction, 0), 1))
                }
            }
            .frame(height: 6)
            if !value.reasoning.isEmpty, value.reasoning.lowercased() != "none" {
                Text(value.reasoning)
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    VStack(spacing: 24) {
        HStack(spacing: 16) {
            ScoreBadge(score: 18)
            ScoreBadge(score: 45)
            ScoreBadge(score: 62)
            ScoreBadge(score: 88)
            PendingScoreBadge()
        }
        ScoreBreakdownView(score: .preview)
    }
    .padding()
    .background(Theme.background)
    .preferredColorScheme(.dark)
}

extension ViralityScore {
    static let preview = ViralityScore(
        totalScore: 58,
        breakdown: [
            "hook_strength": .init(score: 18, max: 25, reasoning: "Opens with a specific number that promises a payoff."),
            "reply_bait": .init(score: 9, max: 25, reasoning: "Ends on a statement, so there's little to reply to."),
            "emotional_charge": .init(score: 9, max: 15, reasoning: "Mild surprise, but no strong feeling."),
            "format_structure": .init(score: 13, max: 15, reasoning: "Short lines and clean whitespace."),
            "niche_consistency": .init(score: 8, max: 10, reasoning: "Squarely in the indie SaaS lane."),
            "risk_factors": .init(score: -5, max: 0, reasoning: "External link in the main post."),
            "timing": .init(score: 6, max: 10, reasoning: "Posted mid-afternoon on a weekday."),
        ],
        topStrength: "A concrete, number-led hook.",
        topWeakness: "Nothing invites a reply.",
        suggestions: [
            "End with a question asking readers what they would cut first.",
            "Move the link into a reply so the main post isn't penalized.",
            "Cut the final sentence; it repeats the hook.",
        ]
    )
}
