from pathlib import Path
root=Path('/tmp/postlock-appstore-work/postlock/Postlock')
p=root/'App/AppSession.swift'
s=p.read_text(); start=s.index('        #if DEBUG\n        if let scenario'); end=s.index('        #endif',start)+len('        #endif')
s=s[:start]+'''        #if DEBUG
        if let scenario = ProcessInfo.processInfo.environment["POSTLOCK_CAPTURE"] {
            let defaults = UserDefaults.standard
            for key in ["postingProfile", "postingCommitment", "postingVerifiedCount", "postingVerifiedDate"] { defaults.removeObject(forKey: key) }
            if scenario != "profile" {
                profileStore.save(.init(username: "postlocktest", displayName: "POSTLOCK Test", avatarURL: nil, isPublic: true, isVerified: false, verificationType: nil))
            }
            if ["hero", "progress", "complete"].contains(scenario) {
                let plan = PostingCommitment.suggested(goal: 3)
                commitmentStore.save(plan)
                commitmentStore.saveVerifiedCount(scenario == "complete" ? 3 : scenario == "progress" ? 1 : 0)
                commitmentStore.saveVerifiedDate(Self.localDate(for: plan))
            }
        }
        #endif''' + s[end:]; p.write_text(s)
p=root/'Features/UsernameSetup/UsernameSetupView.swift'; s=p.read_text(); old='            viewModel = UsernameSetupViewModel(client: session.profileClient)'; s=s.replace(old,old+'''
            #if DEBUG
            if ProcessInfo.processInfo.environment["POSTLOCK_CAPTURE"] == "profile" {
                viewModel?.state = .confirmation(.init(username: "postlocktest", displayName: "POSTLOCK Test", avatarURL: nil, isPublic: true, isVerified: false, verificationType: nil))
            }
            #endif'''); p.write_text(s)
p=root/'Features/Schedule/ScheduleSetupView.swift'; s=p.read_text(); s=s.replace('            #if DEBUG\n', '''            #if DEBUG
            if ProcessInfo.processInfo.environment["POSTLOCK_CAPTURE"] == "blocking" { step = .apps }
''',1); p.write_text(s)
# Use the existing physical-device permission label in the capture build.
p=root/'Features/Today/TodayView.swift'; s=p.read_text(); s=s.replace('''        #if targetEnvironment(simulator)
        return "App protection requires an iPhone"
        #else
''',''); s=s.replace('        #endif\n    }\n}', '    }\n}',1); p.write_text(s)
