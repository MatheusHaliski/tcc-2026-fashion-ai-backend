"""Category-aware seam contracts, extensible without guessing an unknown category."""
from .models import AnchorRule, AlignmentError

R = AnchorRule
UPPER = [R('neck_left'), R('neck_center'), R('neck_right'),
         R('shoulder_left'), R('shoulder_right'), R('axilla_left'), R('axilla_right'),
         R('chest_left', False, 2), R('chest_right', False, 2),
         R('waist_left'), R('waist_right')]
LOWER = [R('waist_left'), R('waist_center'), R('waist_right'),
         R('hip_left', False, 2), R('hip_right', False, 2)]
PROFILES = {
    'TOP': UPPER + [R('hem_left'), R('hem_center'), R('hem_right')],
    'OUTERWEAR': UPPER + [R('hem_left'), R('hem_center'), R('hem_right')],
    'TROUSERS': LOWER + [R('crotch'), R('knee_left', False), R('knee_right', False),
                        R('ankle_left_inner'), R('ankle_left_outer'),
                        R('ankle_right_inner'), R('ankle_right_outer')],
    'SHORTS': LOWER + [R('crotch'), R('hem_left_inner'), R('hem_left_outer'),
                      R('hem_right_inner'), R('hem_right_outer')],
    'SKIRT': LOWER + [R('hem_left'), R('hem_center'), R('hem_right')],
    'DRESS': UPPER + [R('hip_left', False), R('hip_right', False),
                     R('hem_left'), R('hem_center'), R('hem_right')],
    'JUMPSUIT': UPPER + [R('crotch'), R('hip_left', False), R('hip_right', False),
                        R('ankle_left_inner'), R('ankle_left_outer'),
                        R('ankle_right_inner'), R('ankle_right_outer')],
    'FOOTWEAR': [R('heel'), R('ankle_inner'), R('ankle_outer'), R('toe_inner'), R('toe_outer')],
    'EYEWEAR': [R('nasal_bridge'), R('ear_top_left'), R('ear_top_right'), R('zygomatic_left'), R('zygomatic_right')],
    'WATCH': [R('wrist_inner'), R('wrist_outer'), R('wrist_upper'), R('wrist_lower')],
    'HEADWEAR': [R('head_top'), R('temple_left'), R('temple_right'), R('head_back', False)],
    'GLOVES': [R('wrist_inner'), R('wrist_outer'), R('thumb_tip'), R('index_tip'), R('pinky_tip')],
    'NECKWEAR': [R('neck_left'), R('neck_center'), R('neck_right'), R('chest_center', False)],
    'BELT': [R('waist_left'), R('waist_center'), R('waist_right'), R('waist_lower', False)],
}


def rules_for(family: str, sleeve: str = 'NONE', custom_rules=None):
    if custom_rules is not None:
        if not 3 <= len(custom_rules) <= 64:
            raise AlignmentError('CUSTOM_PROFILE_REQUIRES_3_TO_64_ANCHORS')
        rules = list(custom_rules)
    else:
        if family not in PROFILES:
            raise AlignmentError('UNSUPPORTED_CATEGORY_REQUIRES_EXPLICIT_PROFILE')
        rules = list(PROFILES[family])
    if sleeve not in {'NONE', 'SHORT', 'LONG'}:
        raise AlignmentError('INVALID_SLEEVE_PROFILE')
    if sleeve != 'NONE':
        if family not in {'TOP', 'OUTERWEAR', 'DRESS', 'JUMPSUIT'}:
            raise AlignmentError('SLEEVES_NOT_APPLICABLE')
        for side in ('left', 'right'):
            rules += [R(f'biceps_{side}', False, 1.5)]
            if sleeve == 'LONG':
                rules += [R(f'elbow_{side}', False, 2)]
            rules += [R(f'cuff_{side}_inner'), R(f'cuff_{side}_outer')]
    if len({r.name for r in rules}) != len(rules):
        raise AlignmentError('DUPLICATE_ANCHOR_NAME')
    return rules
