// Esqueleto do marco 3: ainda NÃO compilado (ver clients/unreal/README.md).

#include "FaiApiSubsystem.h"

#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "HAL/PlatformProperties.h"
#include "Misc/App.h"

void UFaiApiSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	Platform = DetectPlatform();
	// perfil inicial: o mais leve da família; o servidor confirma em /api/client/config e o benchmark do marco 3 sobe se puder
	Quality = Platform == TEXT("WINDOWS") || Platform == TEXT("MACOS") ? TEXT("DESKTOP_MID") : TEXT("MOBILE_LOW");
}

FString UFaiApiSubsystem::DetectPlatform()
{
	const FString Ini = FPlatformProperties::IniPlatformName();
	if (Ini == TEXT("IOS")) { return TEXT("IOS"); }          // iPad é distinguido pelo plugin FaiPlatform (idiom)
	if (Ini == TEXT("Android")) { return TEXT("ANDROID"); }
	if (Ini == TEXT("Windows")) { return TEXT("WINDOWS"); }
	if (Ini == TEXT("Mac")) { return TEXT("MACOS"); }
	// consoles: definidos no módulo de plataforma restrito (SDK sob NDA), nunca neste repositório
	return TEXT("WEB");
}

FString UFaiApiSubsystem::SlotName(EFaiTryOnSlot Slot)
{
	switch (Slot)
	{
	case EFaiTryOnSlot::Top: return TEXT("TOP");
	case EFaiTryOnSlot::Bottom: return TEXT("BOTTOM");
	case EFaiTryOnSlot::Shoes: return TEXT("SHOES");
	default: return TEXT("ACCESSORY");
	}
}

TSharedRef<IHttpRequest, ESPMode::ThreadSafe> UFaiApiSubsystem::NewRequest(const FString& Verb, const FString& Path) const
{
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
	Req->SetURL(BaseUrl + Path);
	Req->SetVerb(Verb);
	Req->SetHeader(TEXT("Accept"), TEXT("application/json"));
	Req->SetHeader(TEXT("X-FAI-Platform"), Platform);
	Req->SetHeader(TEXT("X-FAI-Quality"), Quality);
	Req->SetHeader(TEXT("X-FAI-App-Version"), FApp::GetBuildVersion());
	if (!AccessToken.IsEmpty())
	{
		Req->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + AccessToken);
	}
	return Req;
}

void UFaiApiSubsystem::FetchClientConfig()
{
	auto Req = NewRequest(TEXT("GET"), TEXT("/api/client/config"));
	Req->OnProcessRequestComplete().BindWeakLambda(this, [this](FHttpRequestPtr, FHttpResponsePtr Res, bool bOk)
	{
		if (!bOk || !Res.IsValid() || Res->GetResponseCode() != 200)
		{
			OnError.Broadcast(Res.IsValid() ? Res->GetResponseCode() : 0, TEXT("CONFIG"));
			return;
		}
		TSharedPtr<FJsonObject> Obj;
		if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Res->GetContentAsString()), Obj) && Obj.IsValid())
		{
			Obj->TryGetStringField(TEXT("qualityProfile"), Quality);
			bool bUpdate = false;
			if (Obj->TryGetBoolField(TEXT("updateRequired"), bUpdate) && bUpdate)
			{
				OnError.Broadcast(426, TEXT("ATUALIZACAO_OBRIGATORIA"));   // a interface leva à loja do aparelho
			}
		}
	});
	Req->ProcessRequest();
}

void UFaiApiSubsystem::FetchAvatarManifest()
{
	auto Req = NewRequest(TEXT("GET"), TEXT("/api/me/avatar3d/canonical"));
	Req->OnProcessRequestComplete().BindWeakLambda(this, [this](FHttpRequestPtr, FHttpResponsePtr Res, bool bOk)
	{
		if (!bOk || !Res.IsValid() || Res->GetResponseCode() != 200)
		{
			OnError.Broadcast(Res.IsValid() ? Res->GetResponseCode() : 0, TEXT("AVATAR"));
			return;
		}
		TSharedPtr<FJsonObject> Obj;
		if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Res->GetContentAsString()), Obj) && Obj.IsValid())
		{
			FString Hash;
			int32 Version = 0;
			Obj->TryGetStringField(TEXT("identityHash"), Hash);
			Obj->TryGetNumberField(TEXT("version"), Version);
			OnAvatarManifest.Broadcast(Hash, Version);   // o renderizador do avatar confere o hash antes de reaproveitar o cache
		}
	});
	Req->ProcessRequest();
}

void UFaiApiSubsystem::RefreshTryOn()
{
	auto Req = NewRequest(TEXT("GET"), TEXT("/api/try-on/session"));
	Req->OnProcessRequestComplete().BindWeakLambda(this, [this](FHttpRequestPtr, FHttpResponsePtr Res, bool bOk)
	{
		if (bOk && Res.IsValid() && Res->GetResponseCode() == 200 && ParseTryOnSession(Res->GetContentAsString(), TryOn))
		{
			OnTryOnChanged.Broadcast(TryOn);
			return;
		}
		OnError.Broadcast(Res.IsValid() ? Res->GetResponseCode() : 0, TEXT("PROVADOR"));
	});
	Req->ProcessRequest();
}

void UFaiApiSubsystem::Wear(EFaiTryOnSlot Slot, const FString& PieceId)
{
	SendTryOnChange(TEXT("PUT"), Slot, FString::Printf(TEXT("{\"pieceId\":\"%s\"}"), *PieceId), false);
}

void UFaiApiSubsystem::TakeOff(EFaiTryOnSlot Slot)
{
	SendTryOnChange(TEXT("DELETE"), Slot, FString(), false);
}

void UFaiApiSubsystem::SendTryOnChange(const FString& Verb, EFaiTryOnSlot Slot, const FString& Body, bool bRetried)
{
	auto Req = NewRequest(Verb, TEXT("/api/try-on/session/slots/") + SlotName(Slot));
	Req->SetHeader(TEXT("If-Match"), FString::Printf(TEXT("\"%lld\""), TryOn.Revision));
	if (!Body.IsEmpty())
	{
		Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
		Req->SetContentAsString(Body);
	}
	Req->OnProcessRequestComplete().BindWeakLambda(this, [this, Verb, Slot, Body, bRetried](FHttpRequestPtr, FHttpResponsePtr Res, bool bOk)
	{
		const int32 Code = Res.IsValid() ? Res->GetResponseCode() : 0;
		if (bOk && Code == 200 && ParseTryOnSession(Res->GetContentAsString(), TryOn))
		{
			OnTryOnChanged.Broadcast(TryOn);
			return;
		}
		if ((Code == 412 || Code == 409) && !bRetried)
		{
			// outro aparelho mudou o provador: adota o estado atual e reaplica UMA vez a ação da pessoa (outro lugar não é perdido)
			TSharedPtr<FJsonObject> Err;
			const TSharedPtr<FJsonObject>* Details = nullptr;
			const TSharedPtr<FJsonObject>* Current = nullptr;
			if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Res->GetContentAsString()), Err) && Err.IsValid()
				&& Err->TryGetObjectField(TEXT("details"), Details) && (*Details)->TryGetObjectField(TEXT("current"), Current))
			{
				double Rev = 0;
				(*Current)->TryGetNumberField(TEXT("revision"), Rev);
				TryOn.Revision = static_cast<int64>(Rev);
				SendTryOnChange(Verb, Slot, Body, true);
				return;
			}
			RefreshTryOn();
			return;
		}
		OnError.Broadcast(Code, TEXT("PROVADOR"));
	});
	Req->ProcessRequest();
}

bool UFaiApiSubsystem::ParseTryOnSession(const FString& Json, FFaiTryOnSession& Out)
{
	TSharedPtr<FJsonObject> Obj;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), Obj) || !Obj.IsValid())
	{
		return false;
	}
	FFaiTryOnSession S;
	double Rev = 0;
	Obj->TryGetNumberField(TEXT("revision"), Rev);
	S.Revision = static_cast<int64>(Rev);
	Obj->TryGetStringField(TEXT("updatedPlatform"), S.UpdatedPlatform);

	const TSharedPtr<FJsonObject>* Avatar = nullptr;
	if (Obj->TryGetObjectField(TEXT("avatar"), Avatar))
	{
		(*Avatar)->TryGetStringField(TEXT("identityId"), S.AvatarIdentityId);
		(*Avatar)->TryGetNumberField(TEXT("version"), S.AvatarVersion);
		(*Avatar)->TryGetBoolField(TEXT("changedSinceLastTryOn"), S.bAvatarChangedSinceLastTryOn);
	}

	const TSharedPtr<FJsonObject>* Slots = nullptr;
	if (Obj->TryGetObjectField(TEXT("slots"), Slots))
	{
		for (EFaiTryOnSlot Slot : { EFaiTryOnSlot::Top, EFaiTryOnSlot::Bottom, EFaiTryOnSlot::Shoes, EFaiTryOnSlot::Accessory })
		{
			const TSharedPtr<FJsonObject>* Entry = nullptr;
			if (!(*Slots)->TryGetObjectField(SlotName(Slot), Entry))
			{
				continue;   // null = lugar vazio
			}
			FFaiWornPiece P;
			const TSharedPtr<FJsonObject>* Piece = nullptr;
			if ((*Entry)->TryGetObjectField(TEXT("piece"), Piece))
			{
				(*Piece)->TryGetStringField(TEXT("id"), P.PieceId);
				(*Piece)->TryGetStringField(TEXT("category"), P.Category);
				(*Piece)->TryGetBoolField(TEXT("fullBody"), P.bFullBody);
			}
			const TSharedPtr<FJsonObject>* Rep = nullptr;
			if ((*Entry)->TryGetObjectField(TEXT("representation"), Rep))
			{
				FString Mode;
				(*Rep)->TryGetStringField(TEXT("mode"), Mode);
				P.Mode = Mode == TEXT("MESH_3D") ? EFaiGarmentMode::Mesh3D : EFaiGarmentMode::Preview2D;
				(*Rep)->TryGetStringField(TEXT("url"), P.AssetUrl);
				(*Rep)->TryGetStringField(TEXT("sha256"), P.AssetSha256);
				(*Rep)->TryGetStringField(TEXT("imageUrl"), P.ImageUrl);
				(*Rep)->TryGetStringField(TEXT("label"), P.Label);
			}
			S.Slots.Add(Slot, P);
		}
	}
	Out = S;
	return true;
}
