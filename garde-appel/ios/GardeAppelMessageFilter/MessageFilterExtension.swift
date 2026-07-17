//
//  MessageFilterExtension.swift
//  GardeAppelMessageFilter (App Extension — IdentityLookup / Message Filter)
//
//  Filtre les SMS provenant d'expéditeurs inconnus. iOS route ces messages
//  vers l'onglet « Indésirables » selon le verdict renvoyé ici.
//
//  Deux phases possibles :
//   1. Hors ligne (offline) : décision immédiate à partir de la liste
//      synchronisée par l'app dans l'App Group.
//   2. Réseau (defer to network) : iOS appelle notre URL de filtrage. Ici on
//      reste hors ligne pour la vie privée ; l'app maintient la liste à jour.
//

import IdentityLookup

let kAppGroupSMS = "group.com.coeuru.gardeappel"
let kFichierSMS = "expediteurs.json"

/// Un expéditeur ou motif de SMS connu, écrit par l'app principale.
struct ExpediteurSignale: Decodable {
    let numero: String   // ex. « +33612345678 »
    let categorie: String // « arnaque » | « demarchage » | « phishing »
}

final class MessageFilterExtension: ILMessageFilterExtension {}

extension MessageFilterExtension: ILMessageFilterQueryHandling {

    func handle(
        _ queryRequest: ILMessageFilterQueryRequest,
        context: ILMessageFilterExtensionContext,
        completion: @escaping (ILMessageFilterQueryResponse) -> Void
    ) {
        let (action, sousAction) = classifierHorsLigne(queryRequest)

        let response = ILMessageFilterQueryResponse()
        response.action = action
        if #available(iOS 14.0, *) {
            response.subAction = sousAction
        }
        completion(response)
    }

    /// Décision immédiate à partir de la liste locale (App Group).
    private func classifierHorsLigne(
        _ requete: ILMessageFilterQueryRequest
    ) -> (ILMessageFilterAction, ILMessageFilterSubAction) {
        guard let expediteur = requete.sender,
              let signale = chercher(expediteur) else {
            return (.none, .none)
        }

        switch signale.categorie {
        case "arnaque", "phishing":
            // Onglet « Indésirables » -> section Jonque/Frauduleux.
            if #available(iOS 14.0, *) {
                return (.junk, .transactionalFraud)
            }
            return (.junk, .none)
        case "demarchage":
            if #available(iOS 14.0, *) {
                return (.junk, .promotionalOthers)
            }
            return (.junk, .none)
        default:
            return (.none, .none)
        }
    }

    /// Cherche un expéditeur dans la liste synchronisée.
    private func chercher(_ numero: String) -> ExpediteurSignale? {
        guard let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: kAppGroupSMS)?
            .appendingPathComponent(kFichierSMS),
              let data = try? Data(contentsOf: url),
              let liste = try? JSONDecoder().decode([ExpediteurSignale].self, from: data)
        else {
            return nil
        }
        let cible = numero.filter { $0.isNumber || $0 == "+" }
        return liste.first { $0.numero == cible }
    }
}
