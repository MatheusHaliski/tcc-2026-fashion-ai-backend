// FashionAI — cliente da API compartilhada (docs/multiplataforma/02-arquitetura-e-contratos.md).
// Esqueleto do marco 3: ainda NÃO compilado (ver clients/unreal/README.md).

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Interfaces/IHttpRequest.h"
#include "FaiApiSubsystem.generated.h"

/** Os quatro lugares do provador; os nomes são os do contrato (TOP, BOTTOM, SHOES, ACCESSORY). */
UENUM(BlueprintType)
enum class EFaiTryOnSlot : uint8
{
	Top,
	Bottom,
	Shoes,
	Accessory
};

/** Como desenhar a peça neste aparelho. */
UENUM(BlueprintType)
enum class EFaiGarmentMode : uint8
{
	None,
	Mesh3D,     // asset aprovado que veste o avatar (esqueleto FAI_BODY_V1)
	Preview2D   // só foto: mostrar como prévia identificada, nunca colada no corpo
};

USTRUCT(BlueprintType)
struct FFaiWornPiece
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString PieceId;
	UPROPERTY(BlueprintReadOnly) FString Category;
	UPROPERTY(BlueprintReadOnly) bool bFullBody = false;
	UPROPERTY(BlueprintReadOnly) EFaiGarmentMode Mode = EFaiGarmentMode::None;
	UPROPERTY(BlueprintReadOnly) FString AssetUrl;      // Mesh3D
	UPROPERTY(BlueprintReadOnly) FString AssetSha256;   // Mesh3D: conferir antes de usar o cache
	UPROPERTY(BlueprintReadOnly) FString ImageUrl;      // Preview2D
	UPROPERTY(BlueprintReadOnly) FString Label;         // Preview2D: texto obrigatório na interface
};

USTRUCT(BlueprintType)
struct FFaiTryOnSession
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) int64 Revision = 0;
	UPROPERTY(BlueprintReadOnly) FString UpdatedPlatform;
	UPROPERTY(BlueprintReadOnly) TMap<EFaiTryOnSlot, FFaiWornPiece> Slots;
	UPROPERTY(BlueprintReadOnly) FString AvatarIdentityId;
	UPROPERTY(BlueprintReadOnly) int32 AvatarVersion = 0;
	UPROPERTY(BlueprintReadOnly) bool bAvatarChangedSinceLastTryOn = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FFaiTryOnSessionChanged, const FFaiTryOnSession&, Session);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FFaiApiError, int32, Status, const FString&, Code);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FFaiAvatarManifest, const FString&, IdentityHash, int32, Version);

/**
 * Estado compartilhado do app: sessão, plataforma, perfil de qualidade e o provador sincronizado.
 * Fluxo do vertical slice: entrar → escolher peça → abrir provador → vestir → voltar à interface com o mesmo estado.
 * O estado do provador vive no servidor; ao voltar para o app (ou reconectar) chamar RefreshTryOn().
 */
UCLASS(Config = Game)
class FASHIONAI_API UFaiApiSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Access token em memória; o refresh fica no armazenamento seguro do SO (plugin FaiPlatform, marco 3). */
	UFUNCTION(BlueprintCallable, Category = "FashionAI") void SetAccessToken(const FString& Token) { AccessToken = Token; }

	UFUNCTION(BlueprintCallable, Category = "FashionAI") void FetchClientConfig();
	UFUNCTION(BlueprintCallable, Category = "FashionAI") void FetchAvatarManifest();
	UFUNCTION(BlueprintCallable, Category = "FashionAI") void RefreshTryOn();
	UFUNCTION(BlueprintCallable, Category = "FashionAI") void Wear(EFaiTryOnSlot Slot, const FString& PieceId);
	UFUNCTION(BlueprintCallable, Category = "FashionAI") void TakeOff(EFaiTryOnSlot Slot);

	UFUNCTION(BlueprintPure, Category = "FashionAI") const FFaiTryOnSession& GetTryOn() const { return TryOn; }
	UFUNCTION(BlueprintPure, Category = "FashionAI") FString GetPlatformHeader() const { return Platform; }

	UPROPERTY(BlueprintAssignable) FFaiTryOnSessionChanged OnTryOnChanged;
	UPROPERTY(BlueprintAssignable) FFaiApiError OnError;
	UPROPERTY(BlueprintAssignable) FFaiAvatarManifest OnAvatarManifest;

	/** Lê o JSON do contrato (exposto para teste automatizado do cliente). */
	static bool ParseTryOnSession(const FString& Json, FFaiTryOnSession& Out);
	static FString SlotName(EFaiTryOnSlot Slot);

private:
	UPROPERTY(Config) FString BaseUrl;
	FString AccessToken;
	FString Platform;
	FString Quality;
	FFaiTryOnSession TryOn;

	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> NewRequest(const FString& Verb, const FString& Path) const;
	void SendTryOnChange(const FString& Verb, EFaiTryOnSlot Slot, const FString& Body, bool bRetried);
	static FString DetectPlatform();
};
