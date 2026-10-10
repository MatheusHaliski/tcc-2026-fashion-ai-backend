using UnrealBuildTool;

public class FashionAIEditorTarget : TargetRules
{
	public FashionAIEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("FashionAI");
	}
}
