import FamilyControls
import ManagedSettings
import SwiftUI

extension View {
    /// The Screen Time picker for the one app kept open while locked (X). The
    /// wording is on the picker itself because it looks like a "choose apps to
    /// block" list, which is how "All Apps" ends up selected.
    ///
    /// Hosted in our own sheet rather than `familyActivityPicker(isPresented:)`:
    /// on iPad that system presentation can come up as an empty card (App Review
    /// hit it right after granting Screen Time access).
    func allowedAppPicker(isPresented: Binding<Bool>, selection: Binding<FamilyActivitySelection>) -> some View {
        sheet(isPresented: isPresented) {
            AllowedAppPickerSheet(selection: selection)
        }
    }
}

struct AllowedAppPickerSheet: View {
    @Binding var selection: FamilyActivitySelection
    @Environment(\.dismiss) private var dismiss
    /// The picker is a remote view from a system process; if that process
    /// stalls it renders nothing, and recreating the view reconnects it.
    @State private var reloadID = 0

    var body: some View {
        NavigationStack {
            FamilyActivityPicker(
                headerText: "Select only X to keep it open. Don't select All Apps: POSTLOCK locks everything else for you.",
                footerText: "Choosing a category or more than one app can't be used as the exception.",
                selection: $selection
            )
            .id(reloadID)
            .navigationTitle("Keep X Available")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reload", systemImage: "arrow.clockwise") { reloadID += 1 }
                        .accessibilityHint("Reloads the app list if it's empty")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
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
