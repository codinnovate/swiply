import Foundation

protocol PostingCommitmentStoring {
    func load() -> PostingCommitment?
    func save(_ commitment: PostingCommitment)
    func loadVerifiedCount() -> Int
    func saveVerifiedCount(_ count: Int)
    func loadVerifiedDate() -> String?
    func saveVerifiedDate(_ date: String)
}

struct UserDefaultsPostingCommitmentStore: PostingCommitmentStoring {
    private let defaults: UserDefaults
    private let commitmentKey = "postingCommitment"
    private let verifiedCountKey = "postingVerifiedCount"
    private let verifiedDateKey = "postingVerifiedDate"

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    func load() -> PostingCommitment? {
        defaults.data(forKey: commitmentKey).flatMap { try? JSONDecoder().decode(PostingCommitment.self, from: $0) }
    }

    func save(_ commitment: PostingCommitment) {
        defaults.set(try? JSONEncoder().encode(commitment), forKey: commitmentKey)
    }

    func loadVerifiedCount() -> Int { defaults.integer(forKey: verifiedCountKey) }
    func saveVerifiedCount(_ count: Int) { defaults.set(count, forKey: verifiedCountKey) }
    func loadVerifiedDate() -> String? { defaults.string(forKey: verifiedDateKey) }
    func saveVerifiedDate(_ date: String) { defaults.set(date, forKey: verifiedDateKey) }
}
