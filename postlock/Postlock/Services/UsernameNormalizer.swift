import Foundation

enum UsernameValidationError: LocalizedError, Equatable {
    case empty
    case invalidURL
    case invalidCharacters
    case tooLong

    var errorDescription: String? {
        switch self {
        case .empty:
            "Enter your X username."
        case .invalidURL:
            "Enter a username or an x.com profile link."
        case .invalidCharacters:
            "Use only letters, numbers, and underscores."
        case .tooLong:
            "X usernames can be up to 15 characters."
        }
    }
}

enum UsernameNormalizer {
    private static let allowedCharacters = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_"))

    static func normalize(_ input: String) throws -> String {
        var candidate = input.trimmingCharacters(in: .whitespacesAndNewlines)

        if candidate.lowercased().hasPrefix("https://") || candidate.lowercased().hasPrefix("http://") {
            guard
                let components = URLComponents(string: candidate),
                let host = components.host?.lowercased(),
                host == "x.com" || host == "www.x.com"
            else { throw UsernameValidationError.invalidURL }

            let segments = components.path.split(separator: "/", omittingEmptySubsequences: true)
            guard segments.count == 1 else { throw UsernameValidationError.invalidURL }
            candidate = String(segments[0])
        } else {
            let lowered = candidate.lowercased()
            for prefix in ["www.x.com/", "x.com/"] where lowered.hasPrefix(prefix) {
                candidate.removeFirst(prefix.count)
                break
            }
        }

        candidate = candidate.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if candidate.hasPrefix("@") { candidate.removeFirst() }
        candidate = candidate.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !candidate.isEmpty else { throw UsernameValidationError.empty }
        guard candidate.count <= 15 else { throw UsernameValidationError.tooLong }
        guard candidate.unicodeScalars.allSatisfy(allowedCharacters.contains) else {
            throw UsernameValidationError.invalidCharacters
        }

        return candidate.lowercased()
    }
}
