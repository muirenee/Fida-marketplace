import XCTest

class RunnerTests: XCTestCase {
  func testProductionIdentityAndPrivacyConfiguration() {
    let bundle = Bundle.main
    XCTAssertTrue(bundle.bundleIdentifier?.hasPrefix("com.fidalix.marketplace.") == true)
    XCTAssertNotNil(bundle.object(forInfoDictionaryKey: "CFBundleDisplayName"))
    if bundle.bundleIdentifier?.hasSuffix("driver") == true {
      let modes = bundle.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String]
      XCTAssertTrue(modes?.contains("location") == true)
      XCTAssertNotNil(bundle.object(forInfoDictionaryKey: "NSLocationAlwaysAndWhenInUseUsageDescription"))
    }
  }
}
