"""
SpectroMind v1.5 - Certified Validator

The ethical core of v1.5 - decides whether to return a result or say "I DON'T KNOW".
Prevents false confidence and hallucinations.

@module engines/validator/certified
@version 1.5.0
"""

from typing import Dict, List, Optional


class CertifiedValidator:
    """
    Final validation and confidence certification.

    Decision Logic:
    - DETERMINED: High confidence, return result
    - INDETERMINATE: Low confidence, return "unknown"
    - REJECTED: Failed sanity checks, reject structure
    """

    def __init__(self, config: Dict):
        """
        Initialize validator with confidence policies.

        Args:
            config: Configuration dict with confidence policies
        """
        policies = config.get('confidence', {}).get('policies', {})
        self.research_threshold = policies.get('research', 0.70)
        self.patent_threshold = policies.get('patent', 0.90)
        self.qc_threshold = policies.get('quality_control', 0.95)

        default_policy = config.get('confidence', {}).get('default_policy', 'research')
        self.active_policy = default_policy

        self.min_fragments = config.get('validator', {}).get('min_fragments', 2)

    def validate(
        self,
        candidate: Dict,
        fragments: List[Dict],
        rmsd_result: Optional[Dict] = None,
        policy: Optional[str] = None
    ) -> Dict:
        """
        Validate candidate and make certification decision.

        Args:
            candidate: Candidate molecule dict with score
            fragments: Detected fragments
            rmsd_result: RMSD calculation result (if forward prediction was done)
            policy: 'research', 'patent', or 'quality_control'

        Returns:
            Dict with decision, confidence_score, and certification status
        """
        # Select policy threshold
        policy = policy or self.active_policy
        threshold_map = {
            'research': self.research_threshold,
            'patent': self.patent_threshold,
            'quality_control': self.qc_threshold,
        }
        threshold = threshold_map.get(policy, self.research_threshold)

        # Collect all scores
        scores = []

        # 1. Candidate base score
        base_score = candidate.get('score', 0.0) / 100.0  # Normalize to 0-1
        scores.append(('base_score', base_score))

        # 2. RMSD score (if available)
        if rmsd_result:
            rmsd_score = rmsd_result.get('score', 0.0) / 100.0
            scores.append(('rmsd_score', rmsd_score))

        # 3. Fragment coverage score
        fragment_score = min(1.0, len(fragments) / max(3, self.min_fragments))
        scores.append(('fragment_score', fragment_score))

        # 4. Validation flags
        validation_flags = candidate.get('validation_flags', {})
        if validation_flags:
            sanity_score = 1.0 if validation_flags.get('passes_sanity', True) else 0.0
            scores.append(('sanity_score', sanity_score))

        # Calculate final confidence (weighted average)
        weights = {
            'base_score': 0.4,
            'rmsd_score': 0.3,
            'fragment_score': 0.2,
            'sanity_score': 0.1,
        }

        final_confidence = 0.0
        total_weight = 0.0

        for score_name, score_value in scores:
            weight = weights.get(score_name, 0.1)
            final_confidence += score_value * weight
            total_weight += weight

        if total_weight > 0:
            final_confidence /= total_weight

        # Make decision
        decision = self._make_decision(final_confidence, threshold, validation_flags)

        return {
            'decision': decision['status'],
            'decision_reason': decision['reason'],
            'confidence_score': round(final_confidence, 3),
            'confidence_policy': policy,
            'threshold': threshold,
            'passes_threshold': final_confidence >= threshold,
            'score_breakdown': dict(scores),
        }

    def _make_decision(
        self,
        confidence: float,
        threshold: float,
        validation_flags: Dict
    ) -> Dict:
        """
        Make final certification decision.

        Args:
            confidence: Final confidence score (0-1)
            threshold: Policy threshold
            validation_flags: Sanity check flags

        Returns:
            Dict with status and reason
        """
        # Check sanity first
        if not validation_flags.get('passes_sanity', True):
            return {
                'status': 'REJECTED',
                'reason': 'Failed chemical sanity checks (valence, strain, Bredt rule)'
            }

        # Check confidence
        if confidence >= threshold:
            return {
                'status': 'DETERMINED',
                'reason': f'Confidence {confidence:.1%} exceeds {threshold:.0%} threshold'
            }
        else:
            return {
                'status': 'INDETERMINATE',
                'reason': f'Confidence {confidence:.1%} below {threshold:.0%} threshold - insufficient data'
            }


def validate_candidate(
    candidate: Dict,
    fragments: List[Dict],
    rmsd_result: Optional[Dict],
    policy: str,
    config: Dict
) -> Dict:
    """
    Convenience function for validation.

    Args:
        candidate: Candidate molecule
        fragments: Detected fragments
        rmsd_result: RMSD result
        policy: Confidence policy
        config: Configuration dict

    Returns:
        Validation result
    """
    validator = CertifiedValidator(config)
    return validator.validate(candidate, fragments, rmsd_result, policy)


if __name__ == '__main__':
    # Test
    config = {
        'confidence': {
            'policies': {
                'research': 0.70,
                'patent': 0.90,
                'quality_control': 0.95,
            },
            'default_policy': 'research'
        },
        'validator': {
            'min_fragments': 2
        }
    }

    # Test 1: High confidence
    candidate = {
        'smiles': 'CC(=O)C',
        'name': 'Acetone',
        'score': 85.0,
        'validation_flags': {
            'passes_sanity': True,
            'valence_ok': True
        }
    }

    fragments = [
        {'type': 'Ketone', 'priority': 9},
        {'type': 'Methyl', 'priority': 5}
    ]

    rmsd_result = {
        'rmsd': 0.5,
        'score': 92.0,
        'passes': True
    }

    result = validate_candidate(candidate, fragments, rmsd_result, 'research', config)
    print("Test 1 (High Confidence):")
    print(f"  Decision: {result['decision']}")
    print(f"  Confidence: {result['confidence_score']}")
    print(f"  Reason: {result['decision_reason']}")

    # Test 2: Low confidence
    candidate2 = {
        'smiles': 'CCCC',
        'name': 'Butane',
        'score': 45.0,
        'validation_flags': {'passes_sanity': True}
    }

    fragments2 = [{'type': 'Alkyl', 'priority': 3}]
    rmsd_result2 = {'rmsd': 2.5, 'score': 30.0, 'passes': False}

    result2 = validate_candidate(candidate2, fragments2, rmsd_result2, 'research', config)
    print("\nTest 2 (Low Confidence):")
    print(f"  Decision: {result2['decision']}")
    print(f"  Confidence: {result2['confidence_score']}")
    print(f"  Reason: {result2['decision_reason']}")

    # Test 3: Failed sanity
    candidate3 = {
        'smiles': 'C1C1C1',  # Invalid
        'name': 'Invalid',
        'score': 90.0,
        'validation_flags': {'passes_sanity': False}
    }

    result3 = validate_candidate(candidate3, fragments, None, 'research', config)
    print("\nTest 3 (Failed Sanity):")
    print(f"  Decision: {result3['decision']}")
    print(f"  Reason: {result3['decision_reason']}")
