import SwiftUI
import RevenueCat

struct PaywallView: View {
    @Environment(PurchasesService.self) private var purchases
    @State private var selectedPackage: Package?
    @State private var isPurchasing = false
    @State private var isRestoring = false
    @State private var showsAllPlans = false
    /// The plan built during onboarding; personalizes the headline when present.
    var plan: PostingCommitment?

    private var currentOffering: Offering? { purchases.offerings?.current }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Spacing.large) {
                topBar
                header

                AdviceMarquee()
                    .padding(.horizontal, -Spacing.extraLarge)

                if currentOffering == nil {
                    ProgressView()
                        .tint(Theme.accent)
                        .frame(maxWidth: .infinity, minHeight: 80)
                }

                if let errorMessage = purchases.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(Theme.danger)
                        .multilineTextAlignment(.center)
                }

                purchaseActions
            }
            .padding(.horizontal, Spacing.extraLarge)
            .padding(.bottom, Spacing.extraLarge)
            .frame(maxWidth: 620)
            .frame(maxWidth: .infinity)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { legalLinks }
        .background(Theme.background.ignoresSafeArea())
        .task {
            if currentOffering == nil { await purchases.loadOfferings() }
            selectAnnualPlan()
        }
        .sheet(isPresented: $showsAllPlans) {
            allPlansSheet
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Theme.background)
        }
    }

    private var topBar: some View {
        HStack {
            HStack(spacing: Spacing.small) {
                Image("BrandMark")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 28, height: 28)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                Text("POSTLOCK")
                    .font(.caption.weight(.black))
                    .tracking(1.4)
                    .foregroundStyle(.white)
            }
            Spacer()
            Button {
                Task { await restore() }
            } label: {
                if isRestoring {
                    ProgressView().tint(Theme.secondaryText)
                        .frame(width: 72, height: 44)
                } else {
                    Text("Restore")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.secondaryText)
                        .frame(minHeight: 44)
                }
            }
            .disabled(isRestoring || isPurchasing)
        }
    }

    private var header: some View {
        VStack(spacing: Spacing.medium) {
            XMarkArtwork()
                .frame(width: 150, height: 164)
                .accessibilityHidden(true)
                .padding(.top, Spacing.large)

            if let plan {
                Text("YOUR PLAN IS READY")
                    .font(.caption.weight(.bold))
                    .tracking(1.4)
                    .foregroundStyle(Theme.accent)
            }

            Text(plan.map(Self.planHeadline) ?? "Grow your X account by showing up.")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .tracking(-0.8)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white)
        }
    }

    /// e.g. "3 posts a day, 5 days a week." Weekday numbers follow Calendar (1 = Sunday).
    private static func planHeadline(_ plan: PostingCommitment) -> String {
        let posts = "\(plan.goal) post\(plan.goal == 1 ? "" : "s") a day"
        let days: String
        switch plan.postingDays {
        case Set(1 ... 7): days = "every day"
        case Set(2 ... 6): days = "on weekdays"
        default: days = "\(plan.postingDays.count) day\(plan.postingDays.count == 1 ? "" : "s") a week"
        }
        return "\(posts), \(days)."
    }

    private var purchaseActions: some View {
        VStack(spacing: Spacing.small) {
            PrimaryButton(
                title: primaryCTATitle,
                isLoading: isPurchasing,
                isDisabled: selectedPackage == nil || isRestoring
            ) {
                Task { await purchase() }
            }
            .padding(.top, Spacing.large)

            if let selectedPackage {
                Text(compactPriceCopy(for: selectedPackage))
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText.opacity(0.72))
                    .multilineTextAlignment(.center)
                    .padding(.top, 2)
            }

            Button {
                selectAnnualPlan()
                showsAllPlans = true
            } label: {
                Text("View all plans")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(minHeight: 36)
            }
            .disabled(isPurchasing)
        }
    }

    private var legalLinks: some View {
        HStack {
            Link("Terms", destination: SubscriptionPlan.termsURL)
            Spacer()
            Link("Privacy", destination: SubscriptionPlan.privacyURL)
        }
        .font(.caption2)
        .foregroundStyle(Theme.secondaryText.opacity(0.6))
        .padding(.horizontal, Spacing.extraLarge)
        .padding(.top, Spacing.small)
        .frame(maxWidth: 620)
        .frame(maxWidth: .infinity)
        .background(Theme.background)
        // Sit partway into the home-indicator area.
        .padding(.bottom, -Spacing.medium)
    }

    private var primaryCTATitle: String {
        guard let selectedPackage else { return "Continue" }
        let hasTrial = selectedPackage.storeProduct.introductoryDiscount?.paymentMode == .freeTrial
        return hasTrial ? "Try for $0" : "Continue"
    }

    private func compactPriceCopy(for package: Package) -> String {
        let price = package.storeProduct.localizedPriceString
        if package.packageType == .annual {
            let monthly = package.storeProduct.localizedPricePerMonth ?? price
            return "Just \(price) per year (\(monthly)/mo)"
        }
        return "Just \(price) per month"
    }

    private func periodLabel(_ period: SubscriptionPeriod) -> String {
        let unit: String
        switch period.unit {
        case .day: unit = period.value == 1 ? "Day" : "Days"
        case .week: unit = period.value == 1 ? "Week" : "Weeks"
        case .month: unit = period.value == 1 ? "Month" : "Months"
        case .year: unit = period.value == 1 ? "Year" : "Years"
        @unknown default: unit = "Days"
        }
        return "\(period.value) \(unit)"
    }

    private func purchase() async {
        guard let selectedPackage, !isPurchasing else { return }
        isPurchasing = true
        defer { isPurchasing = false }
        await purchases.purchase(selectedPackage)
    }

    private func selectAnnualPlan() {
        guard let packages = currentOffering?.availablePackages, !packages.isEmpty else { return }
        selectedPackage = packages.first { $0.packageType == .annual } ?? packages.first
    }

    private func restore() async {
        guard !isRestoring else { return }
        isRestoring = true
        defer { isRestoring = false }
        await purchases.restorePurchases()
    }

    private var allPlansSheet: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: Spacing.large) {
                    VStack(spacing: Spacing.small) {
                        Text("Choose your plan")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        Text("Yearly is selected for the best monthly value.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                            .multilineTextAlignment(.center)
                    }

                    if let packages = currentOffering?.availablePackages {
                        VStack(spacing: Spacing.medium) {
                            ForEach(packages, id: \.identifier) { package in
                                Button {
                                    selectedPackage = package
                                } label: {
                                    PlanCard(
                                        package: package,
                                        isSelected: selectedPackage?.identifier == package.identifier
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    if let selectedPackage {
                        PrimaryButton(
                            title: selectedPackage.storeProduct.introductoryDiscount?.paymentMode == .freeTrial ? "Try for $0" : "Continue",
                            isLoading: isPurchasing,
                            isDisabled: isRestoring
                        ) {
                            Task { await purchase() }
                        }
                        Text(renewalCopy(for: selectedPackage))
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(Spacing.extraLarge)
            }
            .background(Theme.background)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { showsAllPlans = false }
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .tint(Theme.accent)
    }

    private func renewalCopy(for package: Package) -> String {
        let price = package.storeProduct.localizedPriceString
        let billingPeriod = package.packageType == .annual ? "year" : "month"
        if let trial = package.storeProduct.introductoryDiscount, trial.paymentMode == .freeTrial {
            return "\(periodLabel(trial.subscriptionPeriod)) free, then \(price) per \(billingPeriod). Renews automatically until cancelled."
        }
        return "\(price) per \(billingPeriod). Renews automatically until cancelled."
    }
}

private struct PlanCard: View {
    let package: Package
    let isSelected: Bool

    private var isAnnual: Bool { package.packageType == .annual }

    private var trialLabel: String? {
        guard let trial = package.storeProduct.introductoryDiscount,
              trial.paymentMode == .freeTrial else { return nil }
        let value = trial.subscriptionPeriod.value
        let unit: String
        switch trial.subscriptionPeriod.unit {
        case .day: unit = value == 1 ? "day" : "days"
        case .week: unit = value == 1 ? "week" : "weeks"
        case .month: unit = value == 1 ? "month" : "months"
        case .year: unit = value == 1 ? "year" : "years"
        @unknown default: unit = "days"
        }
        return "\(value) \(unit) free, then \(package.storeProduct.localizedPriceString)"
    }

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
                Text(trialLabel ?? package.storeProduct.localizedPriceString)
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

/// X's mark rendered as a lavender clay sculpture to match the rest of POSTLOCK's artwork.
private struct XMarkArtwork: View {
    private let depth = 16

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [Theme.accent.opacity(0.28), .clear],
                    center: .center,
                    startRadius: 0,
                    endRadius: 75
                ))

            ZStack {
                // Extruded sides, stacked from the back so the face sits on top.
                ForEach((1...depth).reversed(), id: \.self) { layer in
                    XLogoShape()
                        .fill(Color(red: 122 / 255, green: 104 / 255, blue: 214 / 255), style: FillStyle(eoFill: true))
                        .offset(x: CGFloat(layer) * 0.3, y: CGFloat(layer) * 0.5)
                }

                XLogoShape()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 232 / 255, green: 226 / 255, blue: 1),
                                Theme.accent,
                                Color(red: 158 / 255, green: 140 / 255, blue: 242 / 255),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .shadow(.inner(color: .white.opacity(0.55), radius: 2.5, x: -1.5, y: -2))
                        .shadow(.inner(color: Color(red: 90 / 255, green: 72 / 255, blue: 190 / 255).opacity(0.45), radius: 3, x: 1.5, y: 2)),
                        style: FillStyle(eoFill: true)
                    )
            }
            .frame(width: 118, height: 121)
            .compositingGroup()
            .shadow(color: Color(red: 60 / 255, green: 45 / 255, blue: 150 / 255).opacity(0.55), radius: 18, x: 4, y: 16)

            Image(systemName: "sparkle")
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(
                    LinearGradient(colors: [.white, Theme.mint], startPoint: .top, endPoint: .bottom)
                )
                .shadow(color: Theme.mint.opacity(0.6), radius: 8)
                .offset(x: 62, y: -60)
        }
    }
}

/// The X logo outline, traced from its 1200×1227 reference artwork.
private struct XLogoShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 1200
        let sy = rect.height / 1227
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }

        var path = Path()
        path.addLines([
            point(714.163, 519.284), point(1160.89, 0), point(1055.03, 0),
            point(667.137, 450.887), point(357.328, 0), point(0, 0),
            point(468.492, 681.821), point(0, 1226.37), point(105.866, 1226.37),
            point(515.491, 750.218), point(842.672, 1226.37), point(1200, 1226.37),
        ])
        path.closeSubpath()
        path.addLines([
            point(569.165, 687.828), point(521.697, 619.934), point(144.011, 79.6944),
            point(306.615, 79.6944), point(611.412, 515.685), point(658.88, 583.579),
            point(1055.08, 1150.3), point(892.476, 1150.3),
        ])
        path.closeSubpath()
        return path
    }
}

/// A real public X post with growth advice, quoted verbatim from its author.
/// Avatars are bundled as `XAvatar-<handle>`.
private struct AdvicePost: Identifiable {
    let id: String
    let name: String
    let handle: String
    let date: String
    let text: String

    var url: URL { URL(string: "https://x.com/\(handle)/status/\(id)")! }
}

private struct AdviceMarquee: View {
    private let topLane = [
        AdvicePost(id: "1508038378821926912", name: "Dakota Robertson", handle: "WrongsToWrite", date: "Mar 27, 2022",
                   text: "How to go viral on Twitter:\n\nDon't focus on writing viral tweets.\n\nFocus on writing valuable tweets."),
        AdvicePost(id: "1973761186681241703", name: "Alex Hormozi", handle: "AlexHormozi", date: "Oct 2, 2025",
                   text: "Do so much volume it would be unreasonable for you to fail.\nStudy each success and see what sets it apart from all the failures.\nRepeat the winning parts even more times.\nDon't change your mind before you let compounding - compound."),
        AdvicePost(id: "1383835052153262084", name: "Sahil Bloom", handle: "SahilBloom", date: "Apr 18, 2021",
                   text: "To grow, you need to be relentlessly consistent.\n\nBecause growth - in your career, startup, writing, or life - comes gradually and then suddenly.\n\n10 threads to help you on your growth journey:"),
        AdvicePost(id: "1635661830134677506", name: "DAN KOE", handle: "thedankoe", date: "Mar 14, 2023",
                   text: "Where most people quit is where greatness is born."),
        AdvicePost(id: "2062478594589274345", name: "pulsss", handle: "0xPulsss", date: "Jun 4, 2026",
                   text: "you're spending all that time on your posts\n\nand lose readers because of the first line\n\nthe best hooks just do one of four things:\n\nsay something they agree with (or want to fight you on)\n\nshare a take they haven't heard yet\n\ndrop a something that makes them go reply to you\n\nor name a problem they're literally dealing with right now\n\nvery effective\n\nbut most still skip this part and wonder why nobody reads"),
    ]

    private let bottomLane = [
        AdvicePost(id: "1867201673363431779", name: "Dickie Bush", handle: "dickiebush", date: "Dec 12, 2024",
                   text: "After 9 months, growth was slow.\n\nSo, I committed to a 30-day writing challenge:\n\nWrite and publish something every single day for 30 days on 𝕏.\n\nIf it didn't work, I'd find something else."),
        AdvicePost(id: "1544293573981528064", name: "Justin Welsh", handle: "thejustinwelsh", date: "Jul 5, 2022",
                   text: "Engage with 6-10 interesting people each week:\n\nMake it a habit to build connections.\n\nHere are some smart folks I've chatted with, just to jam out:\n\n@SahilBloom \n@Nicolascole77\n@TheDanKoe\n@dickiebush\n@heykahn \n@aaditsh\n@wes_kao\n@blakeaburge \n@sweatystartup \n\nIt's \"social\" media."),
        AdvicePost(id: "1709654054752956492", name: "Marichelle E Urquico 🚢", handle: "ilovemarichelle", date: "Oct 4, 2023",
                   text: "\"Hey, let's grow on X together\"\n\nOne week later, poof!\n\nThey're gone.\n\nWhat happened to:\n\n\"Let's like each other's tweets\"\n\"Let's repost each other's content\"\n\"Let's comment on each other's posts\"\n\nWhen you click on their profile, they don't even tweet anymore.\n\nI see it happen to almost everyone who sends me a DM.\n\nGrowing on X is not easy.\n\nYou will feel like giving up because nothing is happening.\n\nYou will feel like it's not for you because others are doing so much better.\n\nYou will feel like there are too many things to learn and you don't have time for it.\n\nBut it's okay to feel this way –– show up anyway.\n\nHere's how you can sustain your presence on X without burning out:\n\n1. Build meaningful connections instead of chasing followers/engagement\n\nSending 50 replies every day is worthless if you don't remember who these people are.\n\nGetting retweets from 100 people is pointless if they won't remember you/what you said.\n\nDM-ing 50 people is tiring if all you do is send the same thing to everybody.\n\nIf you want to enjoy your X journey, focus on being genuine with the people that you encounter.\n\nDon't just talk to them for the sake of talking to them.\n\nYou don't have to engage with them every day.\n\nBut you have to remember them and understand them.\n\nIf you're struggling to keep track of the people you connect with, create Twitter lists.\n\nUsing this Tweetdeck strategy from @dickiebush will save you hundreds of hours:\n\nhttps://twitter.com/dickiebush/status/1587802964990771202\n\n2. Start small and be honest with what you can commit to.\n\nSaying that you'll engage with 50 people every day without having a plan is like every Asian friend I have on New Year's Day:\n\n• I'll go on a diet\n• I won't eat rice at all\n• I'll work out for 2 hours daily\n\nLet's be real.\n\nUnless you're David Goggins, you won't get up every day at 5AM and run 10 miles.\n\nStarting with intensity is a recipe for disaster.\n\nIf you want to build and sustain your habits to grow on X, have a realistic plan.\n\nStart by engaging with 5 people.\n\nThen slowly increase to 10 people.\n\nAnd once you get the hang of it, you can do 20.\n\nSmall actions compound over a long time and build momentum.\n\nBig, inconsistent actions will only lead to failure.\n\n3. Schedule your tweets in advance so you can make time to engage everyday\n\nAs a beginner, you don't want to waste your time posting into the void.\n\nThe only way to get eyeballs on your profile is by engaging with other X users.\n\nBut how do you create your content and engage every day if you have limited time?\n\nBy using a scheduling app like @hypefury.\n\nWriting one week's worth of tweets only takes 2 hours.\n\nThis way, you'll build credibility on your profile while spending time to connect with people every day.\n\n--\n\nIf you liked this post:\n\n1. Follow me @ilovemarichelle\n2. Click repost so it can get to more people"),
        AdvicePost(id: "1753052244319052153", name: "Dickie Bush", handle: "dickiebush", date: "Feb 1, 2024",
                   text: "I'm writing every day in 2024.                                                                                                                                                                                 \n\n9 reasons why:\n\n1. Every piece of writing I publish is a lottery ticket\n\nThe world’s most interesting, wealthy, and successful people all use the same social media algorithm.\n\nAnd this means you never know on whose timeline your writing might end up.\n\nIf I’m putting out consistent, quality ideas, there’s a good chance someone I look up to stumbles upon it.\n\nTo me, this is the modern-day version of “networking.”\n\nRather than wasting time thinking about how I can reach out to the people I look up to, I’m investing time in publishing ideas that make them want to reach out to me.\n\n2. Writing every day helps me think clearly\n\nI use my morning writing time as a “container” to process whatever is going on in my life.\n\nBusiness, health, relationships, everything—I can only fully understand what’s going on once I’ve distilled it into writing.\n\nSo my goal is to do some kind of distillation every morning—whether it’s journaling, writing up plans for me & my team, or talking about ideas I’m interested in (that readers would find interesting as well).\n\n3. Writing every day helps me speak clearly\n\nThe people who sound sharp in speeches and on podcasts have a secret.\n\nThey’re not “riffing off the cuff” — they simply answer questions by repeating ideas they’ve written about hundreds of times.\n\nAnd since they’ve written about them, they’ve taken the time to think through them (which is why they sound clear).\n\n4. Writing every day helps me learn rapidly\n\nThe fastest way to learn something is to:\n\n• Have a project in which you can apply the learning\n• Share those learnings in public\n\nWhy?\n\nThis creates a “lens” through which you will consume that information.\n\nRather than just consume information for the sake of it, you’re going to think about how you could distill and clarify it for yourself and the reader.\n\nAnd that extra time of thinking through the idea is where the “leaps” of learning happen.\n\n5. Every single person I look up to writes consistently\n\nThere are millions of successful investors and entrepreneurs.\n\nBut the ones who I admire the most all have one thing in common:\n\nThey publish their ideas for their customers, shareholders, and partners to read.\n\nHoward Marks, Warren Buffet, Naval Ravikant, Tim Ferriss, Jeff Bezos: the list goes on and on.\n\n6. Writing helps me attract new opportunities passively\n\nAt this point, 90% of the people I talk to on a regular basis I met through my writing.\n\nTeam members, business partners, collaborators, friends, and even my girlfriend I met at a coffee shop while I was writing.\n\nWhy?\n\nEvery piece of writing I publish gives someone a “jumping off point” to reach out to me.\n\nIf the piece resonates with them, they can shoot me a DM with context to start a conversation. And chances are, if someone is interested in similar ideas to me (like the ones I’m writing about), we’re going to get along.\n\n7. Writing is my “keystone” morning habit\n\nI have a block on my calendar every morning from 6 AM to 7:30 AM that says “Writing.”\n\nEvery morning, no matter how I’m feeling or what is going on in my life, I sit down to process ideas.\n\nAnd with each day I log my writing time, I’m reinforcing a personal identity of consistency.\n\nThis identity then spreads to every other area of my life. I’m more dialed in on the fitness front, my sleep is better, my diet is better, and I’m more present in conversation.\n\nThe reverse also holds true—any time these other areas feel out of whack, it’s because I’ve fallen off my daily writing habit.\n\n8. Writing has zero downside and infinite upside\n\nIn the world of investing, winning comes from taking “convex bets” — where there’s a little bit of downside but a massive upside.\n\nWriting is one of those convex bets—except I’ve yet to find any downside.\n\nWorst case, you spend hours writing something that no one reads. But you’re still winning because you better understand the idea and you've improved your writing skill.\n\nBest case, that piece of writing changes your life. It attracts a job opportunity, or sparks a business idea, or leads to a lifelong friendship.\n\n(And this is exactly what happened to me.)\n\n9. Writing is the best way to document the journey\n\nI know when I’m 85 years old, I will wish I had a paper trail of the entire journey.\n\nThe highs & lows.\n\nThe moments of despair & the moments of euphoria.\n\nThe painful days trying to make something work, followed shortly by the breakthrough idea.\n\nAnd my writing is the best way to freeze those moments in time.\n\n—\n\nAaand that’s it. Feeling in absolute flow so far in 2024, and it’s all because of my daily writing habit.\n\nHighly recommend giving it a try ✊\n\nIf you enjoyed this, follow me @dickiebush and bookmark the tweet so it’s easy to find later."),
        AdvicePost(id: "1560972514024734720", name: "Justin Welsh", handle: "thejustinwelsh", date: "Aug 20, 2022",
                   text: "A simple 90-day Twitter game plan:\n\nDay 1: Maximize profile: Why should people follow you?\n\nMonth 1: \"Livestream\" your journey: Teach something daily\n\nMonth 2: Double down: Turn your best Tweets into threads\n\nMonth 3:  Ecosystem: Build a small, relevant network & interact daily"),
    ]

    @State private var openPost: AdvicePost?

    var body: some View {
        VStack(spacing: Spacing.medium) {
            Text("WHAT GROWING ACCOUNTS SAY")
                .font(.caption.weight(.bold))
                .tracking(1.4)
                .foregroundStyle(Theme.accent)

            VStack(spacing: Spacing.medium) {
                MarqueeLane(posts: topLane, direction: .left, speed: 32) { openPost = $0 }
                MarqueeLane(posts: bottomLane, direction: .right, speed: 28) { openPost = $0 }
            }
            .mask {
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .black, location: 0.08),
                        .init(color: .black, location: 0.92),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            }
        }
        .sheet(item: $openPost) { post in
            AdvicePostSheet(post: post)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Theme.background)
        }
    }
}

private struct MarqueeLane: View {
    enum Direction { case left, right }

    let posts: [AdvicePost]
    let direction: Direction
    /// Points per second.
    let speed: Double
    let onSelect: (AdvicePost) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var loopWidth: CGFloat = 0

    private let spacing: CGFloat = 12

    var body: some View {
        if reduceMotion {
            // No auto-scroll: the lane becomes a normal swipeable row.
            ScrollView(.horizontal, showsIndicators: false) {
                row.padding(.horizontal, Spacing.extraLarge)
            }
        } else {
            // A fixed-height slot keeps the double-width row from widening the page.
            Color.clear
                .frame(height: AdvicePostCard.height)
                .overlay(alignment: .leading) {
                    TimelineView(.animation(paused: loopWidth == 0)) { context in
                        HStack(spacing: spacing) {
                            row.background {
                                GeometryReader { proxy in
                                    Color.clear
                                        .onAppear { loopWidth = proxy.size.width + spacing }
                                        .onChange(of: proxy.size.width) { _, width in loopWidth = width + spacing }
                                }
                            }
                            row.accessibilityHidden(true)
                        }
                        .fixedSize()
                        .offset(x: offset(at: context.date))
                    }
                }
                .clipped()
        }
    }

    private var row: some View {
        HStack(spacing: spacing) {
            ForEach(posts) { post in
                Button { onSelect(post) } label: { AdvicePostCard(post: post) }
                    .buttonStyle(.plain)
            }
        }
    }

    private func offset(at date: Date) -> CGFloat {
        guard loopWidth > 0 else { return 0 }
        let travelled = CGFloat((date.timeIntervalSinceReferenceDate * speed)
            .truncatingRemainder(dividingBy: Double(loopWidth)))
        return direction == .left ? -travelled : travelled - loopWidth
    }
}

private struct AdvicePostCard: View {
    static let height: CGFloat = 124

    let post: AdvicePost

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            HStack(spacing: Spacing.small) {
                Image("XAvatar-\(post.handle)")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 32, height: 32)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 0) {
                    Text(post.name)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("@\(post.handle)")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                XLogoShape()
                    .fill(.white.opacity(0.55), style: FillStyle(eoFill: true))
                    .frame(width: 13, height: 13.3)
            }

            Text(post.text.split(whereSeparator: \.isNewline).joined(separator: " "))
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.9))
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(width: 240, height: Self.height, alignment: .topLeading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
        .overlay { RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.07)) }
        .contentShape(RoundedRectangle(cornerRadius: 18))
        .accessibilityElement(children: .combine)
        .accessibilityHint("Shows the full post")
    }
}

private struct AdvicePostSheet: View {
    let post: AdvicePost

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.large) {
                HStack(spacing: Spacing.medium) {
                    Image("XAvatar-\(post.handle)")
                        .resizable()
                        .scaledToFill()
                        .frame(width: 44, height: 44)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(post.name)
                            .font(.headline)
                            .foregroundStyle(.white)
                        Text("@\(post.handle)")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    Spacer(minLength: 0)
                    XLogoShape()
                        .fill(.white, style: FillStyle(eoFill: true))
                        .frame(width: 18, height: 18.4)
                }

                Text(post.text)
                    .font(.body)
                    .foregroundStyle(.white)
                    .lineSpacing(3)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(post.date)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)

                Link(destination: post.url) {
                    Label("View on X", systemImage: "arrow.up.right")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(minHeight: 44)
                }
            }
            .padding(Spacing.extraLarge)
            .padding(.top, Spacing.small)
        }
    }
}

struct ValueOnboardingView: View {
    let completed: () -> Void
    @State private var page = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let pages = [
        ValueOnboardingPage(
            image: "OnboardingRhythm",
            eyebrow: "GROW BY SHOWING UP",
            title: "The accounts you notice keep posting.",
            detail: "Show up consistently, learn what connects, and give people a reason to follow.",
            noteIcon: "calendar.badge.clock",
            note: "You do not need the perfect post. You need the next one."
        ),
        ValueOnboardingPage(
            image: "OnboardingFocus",
            eyebrow: "POST BEFORE YOU SCROLL",
            title: "Make distraction wait.",
            detail: "Your apps stay blocked until you post on X. Post, check in, and get back to your day.",
            noteIcon: "hand.raised.fill",
            note: "Your growth gets your attention first."
        ),
        ValueOnboardingPage(
            image: "OnboardingMomentum",
            eyebrow: "CREATE MORE CHANCES",
            title: "You cannot go viral if you never post.",
            detail: "Build the habit, sharpen your voice, and turn a quiet X account into one people remember.",
            noteIcon: "eye.fill",
            note: "Every post is another chance to be discovered."
        )
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 6) {
                    ForEach(pages.indices, id: \.self) { index in
                        Capsule()
                            .fill(index <= page ? Theme.accent : Theme.secondarySurface)
                            .frame(width: index == page ? 28 : 8, height: 8)
                    }
                }
                Spacer()
                Text("\(page + 1) of \(pages.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .monospacedDigit()
            }
            .padding(.horizontal, Spacing.extraLarge)
            .padding(.top, Spacing.large)

            TabView(selection: $page) {
                ForEach(pages.indices, id: \.self) { index in
                    ValueOnboardingPageView(page: pages[index])
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            VStack(spacing: Spacing.medium) {
                PrimaryButton(title: page == pages.count - 1 ? "Build My Plan" : "Continue") {
                    if page == pages.count - 1 {
                        completed()
                    } else if reduceMotion {
                        page += 1
                    } else {
                        withAnimation(.easeInOut(duration: 0.25)) { page += 1 }
                    }
                }

                if page > 0 {
                    Button("Back") {
                        if reduceMotion { page -= 1 }
                        else { withAnimation(.easeInOut(duration: 0.25)) { page -= 1 } }
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(minHeight: 44)
                }
            }
            .padding(.horizontal, Spacing.extraLarge)
            .padding(.bottom, Spacing.large)
        }
        .background(Theme.background.ignoresSafeArea())
    }
}

private struct ValueOnboardingPage {
    let image: String
    let eyebrow: String
    let title: String
    let detail: String
    let noteIcon: String
    let note: String
}

private struct ValueOnboardingPageView: View {
    let page: ValueOnboardingPage

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Spacing.extraLarge) {
                Image(page.image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 310, maxHeight: 300)
                    .accessibilityHidden(true)

                VStack(spacing: Spacing.medium) {
                    Text(page.eyebrow)
                        .font(.caption.weight(.bold))
                        .tracking(1.4)
                        .foregroundStyle(Theme.accent)
                    Text(page.title)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .tracking(-0.8)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white)
                    Text(page.detail)
                        .font(.body)
                        .foregroundStyle(Theme.secondaryText)
                        .multilineTextAlignment(.center)
                        .lineSpacing(3)
                }

                Label(page.note, systemImage: page.noteIcon)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.white.opacity(0.88))
                    .padding(Spacing.large)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
            }
            .padding(.horizontal, Spacing.extraLarge)
            .padding(.vertical, Spacing.large)
            .frame(maxWidth: 620)
            .frame(maxWidth: .infinity)
        }
    }
}
