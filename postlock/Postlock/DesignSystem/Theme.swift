import SwiftUI

enum Theme {
    static let background = Color(red: 13 / 255, green: 14 / 255, blue: 20 / 255)
    static let surface = Color(red: 23 / 255, green: 25 / 255, blue: 35 / 255)
    static let secondarySurface = Color(red: 34 / 255, green: 36 / 255, blue: 49 / 255)
    static let accent = Color(red: 187 / 255, green: 174 / 255, blue: 1)
    static let mint = Color(red: 143 / 255, green: 224 / 255, blue: 194 / 255)
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
