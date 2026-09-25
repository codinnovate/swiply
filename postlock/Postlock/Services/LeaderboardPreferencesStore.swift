import Foundation
import Security

/// On-device leaderboard and scoring preferences.
protocol LeaderboardPreferencesStoring {
    var installID: UUID { get }
    var isOptedIn: Bool { get nonmutating set }
    var niche: String { get nonmutating set }
}

struct DefaultLeaderboardPreferencesStore: LeaderboardPreferencesStoring {
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// Identifies this install to the server, which lets only the install that
    /// opted a username in change its leaderboard consent. Kept in the Keychain
    /// so the claim survives reinstalls.
    var installID: UUID {
        if let stored = Keychain.read(Self.installIDKey).flatMap(UUID.init(uuidString:)) {
            return stored
        }
        let created = UUID()
        Keychain.write(created.uuidString, for: Self.installIDKey)
        return created
    }

    var isOptedIn: Bool {
        get { defaults.bool(forKey: "leaderboardOptedIn") }
        nonmutating set { defaults.set(newValue, forKey: "leaderboardOptedIn") }
    }

    var niche: String {
        get { defaults.string(forKey: "accountNiche") ?? "" }
        nonmutating set { defaults.set(newValue, forKey: "accountNiche") }
    }

    private static let installIDKey = "com.swiply.postlock.installID"
}

private enum Keychain {
    static func read(_ key: String) -> String? {
        var result: AnyObject?
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func write(_ value: String, for key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = Data(value.utf8)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }
}
