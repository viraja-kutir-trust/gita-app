import ExpoModulesCore
import MLKitTranslate

public class MlkitTranslateModule: Module {
  // ML Kit translators must stay alive while their callbacks are pending.
  private var translators: [String: Translator] = [:]

  public func definition() -> ModuleDefinition {
    Name("MlkitTranslate")

    AsyncFunction("translate") { (texts: [String], from: String, to: String, promise: Promise) in
      let source = TranslateLanguage(rawValue: from)
      let target = TranslateLanguage(rawValue: to)
      let all = TranslateLanguage.allLanguages()
      guard all.contains(source), all.contains(target) else {
        promise.reject("ERR_UNSUPPORTED_LANGUAGE", "Can't translate \(from) to \(to) on this device")
        return
      }
      let key = "\(from)-\(to)"
      let translator = self.translators[key]
        ?? Translator.translator(options: TranslatorOptions(sourceLanguage: source, targetLanguage: target))
      self.translators[key] = translator

      let conditions = ModelDownloadConditions(allowsCellularAccess: true, allowsBackgroundDownloading: true)
      translator.downloadModelIfNeeded(with: conditions) { error in
        if let error = error {
          promise.reject("ERR_MODEL_DOWNLOAD", error.localizedDescription)
          return
        }
        var out = [String](repeating: "", count: texts.count)
        func step(_ i: Int) {
          if i == texts.count {
            promise.resolve(out)
            return
          }
          translator.translate(texts[i]) { result, error in
            if let error = error {
              promise.reject("ERR_TRANSLATE", error.localizedDescription)
              return
            }
            out[i] = result ?? ""
            step(i + 1)
          }
        }
        step(0)
      }
    }.runOnQueue(.main)

    AsyncFunction("downloadedModels") { () -> [String] in
      return ModelManager.modelManager().downloadedTranslateModels.map { $0.language.rawValue }
    }.runOnQueue(.main)

    AsyncFunction("deleteModel") { (code: String, promise: Promise) in
      let model = TranslateRemoteModel.translateRemoteModel(language: TranslateLanguage(rawValue: code))
      ModelManager.modelManager().deleteDownloadedModel(model) { error in
        if let error = error {
          promise.reject("ERR_MODEL_DELETE", error.localizedDescription)
        } else {
          promise.resolve(true)
        }
      }
    }.runOnQueue(.main)
  }
}
