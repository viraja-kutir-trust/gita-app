package expo.modules.mlkittranslate

import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MlkitTranslateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MlkitTranslate")

    AsyncFunction("translate") { texts: List<String>, from: String, to: String, promise: Promise ->
      val source = TranslateLanguage.fromLanguageTag(from)
      val target = TranslateLanguage.fromLanguageTag(to)
      if (source == null || target == null) {
        promise.reject("ERR_UNSUPPORTED_LANGUAGE", "Can't translate $from to $to on this device", null)
        return@AsyncFunction
      }
      val translator = Translation.getClient(
        TranslatorOptions.Builder().setSourceLanguage(source).setTargetLanguage(target).build()
      )
      translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
        .continueWithTask { download ->
          if (!download.isSuccessful) throw download.exception ?: Exception("Model download failed")
          Tasks.whenAllSuccess<String>(texts.map { translator.translate(it) })
        }
        .addOnSuccessListener { out ->
          promise.resolve(out)
          translator.close()
        }
        .addOnFailureListener { e ->
          promise.reject("ERR_TRANSLATE", e.message, e)
          translator.close()
        }
    }

    AsyncFunction("downloadedModels") { promise: Promise ->
      RemoteModelManager.getInstance()
        .getDownloadedModels(TranslateRemoteModel::class.java)
        .addOnSuccessListener { models -> promise.resolve(models.map { it.language }) }
        .addOnFailureListener { e -> promise.reject("ERR_MODELS", e.message, e) }
    }

    AsyncFunction("deleteModel") { code: String, promise: Promise ->
      RemoteModelManager.getInstance()
        .deleteDownloadedModel(TranslateRemoteModel.Builder(code).build())
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { e -> promise.reject("ERR_MODEL_DELETE", e.message, e) }
    }
  }
}
