import Foundation

protocol PostingProfileStoring {
    func load() -> PostingProfile?
    func save(_ profile: PostingProfile)
}

struct UserDefaultsPostingProfileStore: PostingProfileStoring {
    private let defaults: UserDefaults
    private let key = "postingProfile"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> PostingProfile? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(PostingProfile.self, from: data)
    }

    func save(_ profile: PostingProfile) {
        guard let data = try? JSONEncoder().encode(profile) else { return }
        defaults.set(data, forKey: key)
    }
}
