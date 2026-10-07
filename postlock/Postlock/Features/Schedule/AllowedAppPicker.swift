import FamilyControls
import ManagedSettings
import SwiftUI

extension View {
    /// The Screen Time picker for the one app kept open while locked (X). The
    /// wording is on the picker itself because it looks like a "choose apps to
    /// block" list, which is how "All Apps" ends up selected.
    func allowedAppPicker(isPresented: Binding<Bool>, selection: Binding<FamilyActivitySelection>) -> some View {
        familyActivityPicker(
            headerText: "Select only X to keep it open. Don't select All Apps: POSTLOCK locks everything else for you.",
            footerText: "Choosing a category or more than one app can't be used as the exception.",
            isPresented: isPresented,
            selection: selection
        )
    }
}

/// The app currently kept open, drawn by the system with its real icon and
/// name, or what's wrong with the selection.
struct AllowedAppStatus: View {
    let token: ApplicationToken?
    let issue: AllowedAppIssue?

    var body: some View {
        if let token {
            Label(token).labelStyle(.titleAndIcon)
        } else if let issue {
            Text(issue.message).foregroundStyle(issue == .nothingSelected ? Theme.secondaryText : Theme.danger)
        }
    }
}
