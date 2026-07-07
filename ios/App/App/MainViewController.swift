import UIKit
import Capacitor

// CAPBridgeViewController 서브클래스 — iOS WKWebView 문서 스크롤의 고무줄(rubber-band)
// 바운스를 끈다. body 문서 스크롤의 최상단/최하단 바운스는 CSS(overscroll-behavior)로
// 막을 수 없어(iOS 메인 프레임은 네이티브 scrollView.bounces 소관) position:fixed 하단
// 네비바가 밀려 "떴다 붙었다" 하던 문제를 여기서 차단한다.
// ★ iOS 네이티브 전용 — 웹/PWA/안드로이드에는 전혀 영향 없음.
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        webView?.scrollView.alwaysBounceHorizontal = false
    }
}
