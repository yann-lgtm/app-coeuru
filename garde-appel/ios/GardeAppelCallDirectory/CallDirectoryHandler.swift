//
//  CallDirectoryHandler.swift
//  GardeAppelCallDirectory (App Extension — Call Directory)
//
//  Fournit à iOS des libellés d'identification pour les appels entrants
//  (ex. « ⚠️ Arnaque probable », « 📢 Démarchage »). Ces libellés
//  s'affichent sur l'écran d'appel natif, même quand l'app est fermée.
//
//  iOS n'autorise PAS de requête réseau au moment de l'appel : l'extension
//  lit une liste pré-synchronisée par l'app principale dans le conteneur
//  partagé (App Group). L'app appelle Supabase puis écrit `numeros.json`
//  et déclenche un rechargement de cette extension.
//

import Foundation
import CallKit

// App Group partagé entre l'app et l'extension (cf. app.json / Xcode).
let kAppGroup = "group.com.coeuru.gardeappel"
let kFichierNumeros = "numeros.json"

/// Une entrée d'identification, telle qu'écrite par l'app principale.
struct EntreeIdentification: Decodable {
    let numero: Int64   // E.164 sans « + », ex. 33612345678
    let libelle: String // ex. « ⚠️ Arnaque probable »
}

class CallDirectoryHandler: CXCallDirectoryProvider {

    override func beginRequest(with context: CXCallDirectoryExtensionContext) {
        context.delegate = self

        // Rechargement complet (pas incrémental) : simple et robuste.
        if !ajouterIdentifications(to: context) {
            context.cancelRequest(withError: NSError(
                domain: "GardeAppelCallDirectory", code: 1, userInfo: nil))
            return
        }

        context.completeRequest()
    }

    /// Charge les entrées depuis le conteneur partagé et les ajoute au contexte.
    /// IMPORTANT : les numéros doivent être ajoutés par ordre croissant.
    private func ajouterIdentifications(
        to context: CXCallDirectoryExtensionContext
    ) -> Bool {
        guard let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: kAppGroup)?
            .appendingPathComponent(kFichierNumeros),
              let data = try? Data(contentsOf: url),
              let entrees = try? JSONDecoder().decode([EntreeIdentification].self, from: data)
        else {
            // Pas encore de fichier synchronisé : rechargement vide valide.
            return true
        }

        let triees = entrees.sorted { $0.numero < $1.numero }
        for entree in triees {
            context.addIdentificationEntry(
                withNextSequentialPhoneNumber: entree.numero,
                label: entree.libelle
            )
        }
        return true
    }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
    func requestFailed(
        for extensionContext: CXCallDirectoryExtensionContext,
        withError error: Error
    ) {
        // iOS invalide la requête : on log, iOS réessaiera plus tard.
        NSLog("GardeAppel Call Directory a échoué : \(error.localizedDescription)")
    }
}
