import SwiftUI

enum Theme {
    static let background = Color(red: 11 / 255, green: 12 / 255, blue: 14 / 255)
    static let surface = Color(red: 19 / 255, green: 21 / 255, blue: 24 / 255)
    static let secondarySurface = Color(red: 25 / 255, green: 28 / 255, blue: 32 / 255)
    static let accent = Color(red: 183 / 255, green: 1, blue: 60 / 255)
    static let secondaryText = Color(red: 152 / 255, green: 156 / 255, blue: 163 / 255)
    static let danger = Color(red: 1, green: 111 / 255, blue: 97 / 255)
}

enum Spacing {
    static let small: CGFloat = 8
    static let medium: CGFloat = 12
    static let large: CGFloat = 16
    static let extraLarge: CGFloat = 24
    static let huge: CGFloat = 32
}
