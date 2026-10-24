import AppKit
import SwiftUI
import UniformTypeIdentifiers
import WebKit

@main
struct NotepadApp: App {
    @StateObject private var model = NotepadModel()

    var body: some Scene {
        WindowGroup {
            NotepadWindow(model: model)
                .frame(minWidth: 640, minHeight: 460)
        }
        .defaultSize(width: 1000, height: 720)
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About D-Writing-Pad") {
                    NSApp.orderFrontStandardAboutPanel(options: [
                        .applicationName: "D-Writing-Pad",
                        .applicationVersion: "Version 1.0",
                    ])
                }
            }

            CommandGroup(replacing: .newItem) {
                Button("New Note") {
                    model.runJavaScript("document.querySelector('#new-button').click()")
                }
                .keyboardShortcut("n", modifiers: .command)

                Button("Open…") {
                    model.openFiles()
                }
                .keyboardShortcut("o", modifiers: .command)

                Button("Save As…") {
                    model.saveActiveNote()
                }
                .keyboardShortcut("s", modifiers: .command)

                Button("Toggle MaltoEng Input") {
                    model.runJavaScript("document.querySelector('#manglish-button').click()")
                }
                .keyboardShortcut("m", modifiers: .command)
            }
        }
    }
}

@MainActor
private final class NotepadModel: ObservableObject {
    private let storageKey = "notepad.notes.v1"
    private let wrapTextKey = "notepad.wrap-text"
    private let fontSizeKey = "notepad.font-size"
    weak var webView: WKWebView?

    func runJavaScript(_ script: String) {
        webView?.evaluateJavaScript(script) { _, error in
            if let error {
                NSLog("Notepad JavaScript error: %@", error.localizedDescription)
            }
        }
    }

    func openFiles() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.plainText, .text, UTType(filenameExtension: "md") ?? .plainText]
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.prompt = "Open"

        guard panel.runModal() == .OK else { return }

        var files: [[String: String]] = []
        var failures: [String] = []
        for url in panel.urls {
            do {
                let content = try String(contentsOf: url, encoding: .utf8)
                files.append([
                    "name": url.deletingPathExtension().lastPathComponent,
                    "content": content,
                ])
            } catch {
                failures.append("\(url.lastPathComponent): \(error.localizedDescription)")
            }
        }

        if !files.isEmpty,
           let data = try? JSONSerialization.data(withJSONObject: files),
           let json = String(data: data, encoding: .utf8) {
            runJavaScript("window.openNativeFiles(\(json))")
        }
        if !failures.isEmpty {
            showError("Some files could not be opened:\n\n" + failures.joined(separator: "\n"))
        }
    }

    func saveActiveNote() {
        runJavaScript("document.querySelector('#save-button').click()")
    }

    func saveNote(name: String, content: String) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.plainText]
        panel.nameFieldStringValue = "\(safeFilename(name)).txt"
        panel.canCreateDirectories = true
        panel.prompt = "Save"

        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try content.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            showError("The file could not be saved: \(error.localizedDescription)")
        }
    }

    func saveNotes(_ notes: Any) {
        do {
            let data = try JSONSerialization.data(withJSONObject: notes)
            UserDefaults.standard.set(data, forKey: storageKey)
        } catch {
            showError("Your notes could not be saved: \(error.localizedDescription)")
        }
    }

    func initialNotesJSON() -> String {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let json = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return json
    }

    func initialWrapText() -> Bool {
        UserDefaults.standard.bool(forKey: wrapTextKey)
    }

    func saveWrapText(_ enabled: Bool) {
        UserDefaults.standard.set(enabled, forKey: wrapTextKey)
    }

    func initialFontSize() -> Int {
        let saved = UserDefaults.standard.integer(forKey: fontSizeKey)
        return saved == 0 ? 13 : min(32, max(10, saved))
    }

    func saveFontSize(_ fontSize: Int) {
        guard (10...32).contains(fontSize) else {
            showError("The font size must be between 10 and 32 points.")
            return
        }
        UserDefaults.standard.set(fontSize, forKey: fontSizeKey)
    }

    func showError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "D-Writing-Pad"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.runModal()
    }

    private func safeFilename(_ name: String) -> String {
        let cleaned = name
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "Untitled" : cleaned
    }
}

@MainActor
private struct NotepadWindow: View {
    @ObservedObject var model: NotepadModel

    var body: some View {
        NotepadWebView(model: model)
            .background(Color(red: 0.067, green: 0.071, blue: 0.086))
    }
}

@MainActor
private struct NotepadWebView: NSViewRepresentable {
    let model: NotepadModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeNSView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "notepad")
        let initialNotes = WKUserScript(
            source: "window.__nativeNotes = \(model.initialNotesJSON()); window.__nativeWrapText = \(model.initialWrapText() ? "true" : "false"); window.__nativeFontSize = \(model.initialFontSize());",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        contentController.addUserScript(initialNotes)

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        let webView = WKWebView(frame: .zero, configuration: configuration)
        model.webView = webView

        let resources = Bundle.main.bundleURL.appendingPathComponent("Contents/Resources")
        let page = resources.appendingPathComponent("index.html")
        webView.loadFileURL(page, allowingReadAccessTo: resources)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        private let model: NotepadModel

        init(model: NotepadModel) {
            self.model = model
        }

        @MainActor
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard let body = message.body as? [String: Any],
                  let action = body["action"] as? String else {
                model.showError("The app received an invalid request.")
                return
            }

            switch action {
            case "open":
                model.openFiles()
            case "persist":
                guard let notes = body["notes"] else {
                    model.showError("The app could not save the current notes.")
                    return
                }
                model.saveNotes(notes)
            case "wrapPreference":
                guard let enabled = body["enabled"] as? Bool else {
                    model.showError("The app could not save the text-wrap preference.")
                    return
                }
                model.saveWrapText(enabled)
            case "fontSizePreference":
                guard let fontSize = body["fontSize"] as? Int else {
                    model.showError("The app could not save the font-size preference.")
                    return
                }
                model.saveFontSize(fontSize)
            case "save":
                guard let name = body["name"] as? String,
                      let content = body["content"] as? String else {
                    model.showError("The app could not save this file.")
                    return
                }
                model.saveNote(name: name, content: content)
            default:
                model.showError("The app received an unknown request.")
            }
        }
    }
}
