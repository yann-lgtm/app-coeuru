//
//  GardeAppelSync.swift
//  Module natif React Native.
//
//  Pont entre le JS et les extensions iOS :
//   - écrit la liste des numéros/expéditeurs signalés dans le conteneur
//     partagé (App Group), lisible par les extensions même app fermée ;
//   - déclenche le rechargement de l'extension Call Directory.
//
//  L'app JS appelle `synchroniser(...)` après avoir récupéré la liste
//  depuis Supabase.
//

import Foundation
import CallKit
import React

@objc(GardeAppelSync)
class GardeAppelSync: NSObject {

  private let appGroup = "group.com.coeuru.gardeappel"
  private let extensionBundleId = "com.coeuru.gardeappel.CallDirectory"

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  /// Écrit les listes partagées puis recharge l'extension d'identification d'appel.
  /// - numeros : [{ numero: Int64 (E.164 sans +), libelle: String }]
  /// - expediteurs : [{ numero: String, categorie: String }]
  @objc(synchroniser:expediteurs:resolver:rejecter:)
  func synchroniser(
    _ numeros: NSArray,
    expediteurs: NSArray,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let dossier = FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      reject("APP_GROUP", "App Group introuvable : \(appGroup)", nil)
      return
    }

    do {
      let dataNumeros = try JSONSerialization.data(withJSONObject: numeros)
      try dataNumeros.write(to: dossier.appendingPathComponent("numeros.json"))

      let dataExpediteurs = try JSONSerialization.data(withJSONObject: expediteurs)
      try dataExpediteurs.write(to: dossier.appendingPathComponent("expediteurs.json"))
    } catch {
      reject("ECRITURE", "Écriture impossible : \(error.localizedDescription)", error)
      return
    }

    // Recharge l'extension Call Directory pour prendre en compte la nouvelle liste.
    CXCallDirectoryManager.sharedInstance.reloadExtension(
      withIdentifier: extensionBundleId
    ) { error in
      if let error = error {
        reject("RECHARGE", "Rechargement échoué : \(error.localizedDescription)", error)
      } else {
        resolve(["ok": true])
      }
    }
  }

  /// Renvoie l'état d'activation de l'extension Call Directory (activée dans Réglages).
  @objc(statutExtension:rejecter:)
  func statutExtension(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    CXCallDirectoryManager.sharedInstance.getEnabledStatusForExtension(
      withIdentifier: extensionBundleId
    ) { status, error in
      if let error = error {
        reject("STATUT", error.localizedDescription, error)
        return
      }
      let libelle: String
      switch status {
      case .enabled: libelle = "active"
      case .disabled: libelle = "desactive"
      default: libelle = "inconnu"
      }
      resolve(["statut": libelle])
    }
  }
}
