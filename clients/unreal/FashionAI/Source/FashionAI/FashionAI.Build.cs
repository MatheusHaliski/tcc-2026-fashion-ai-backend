using UnrealBuildTool;

public class FashionAI : ModuleRules
{
	public FashionAI(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "HTTP", "Json", "JsonUtilities" });
		PrivateDependencyModuleNames.AddRange(new string[] { "CommonUI", "EnhancedInput", "UMG", "Slate", "SlateCore" });
	}
}
