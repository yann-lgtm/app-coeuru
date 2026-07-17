//
//  GardeAppelSync.m
//  Expose le module Swift GardeAppelSync à React Native (pont Objective-C).
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(GardeAppelSync, NSObject)

RCT_EXTERN_METHOD(synchroniser:(NSArray *)numeros
                  expediteurs:(NSArray *)expediteurs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(statutExtension:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
