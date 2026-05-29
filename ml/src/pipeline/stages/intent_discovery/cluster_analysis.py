from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportAny=false
import re
from collections import Counter, defaultdict
from typing import NotRequired, TypedDict

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer  # type: ignore[import-untyped]

from pipeline.stages.intent_discovery.domain_profile import RootDomainProfile
from pipeline.stages.intent_discovery.evaluation import (
    branching_explainability_score,
    interpretability_score,
    workflow_consistency_score,
)
from pipeline.stages.intent_discovery.types import (
    DEFAULT_TFIDF_TOP_KEYWORDS,
    WORKFLOW_SIGNAL_KEYS,
    ClusterQuality,
    ClusterResult,
    NovelIntentCandidate,
    ProcessedConversation,
)

_GENERIC_KEYWORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "for",
        "of",
        "or",
        "please",
        "the",
        "to",
        "제가",
        "저는",
        "지금",
        "오늘",
        "한번",
        "바로",
        "다른",
        "다음",
        "때문에",
        "해서",
        "하는",
        "하려고",
        "하려면",
        "하면서",
        "했는데",
        "거라서",
        "건가요",
        "건지",
        "거죠",
        "거든",
        "거든요",
        "보겠습니다",
        "부탁드릴게",
        "부탁드릴게요",
        "서비스가",
        "그럼",
        "그리고",
        "혹시",
        "문의",
        "문의드립니다",
        "문의드",
        "문의드릴",
        "문의하나드립니다",
        "문의사항",
        "관련",
        "요청",
        "요청드렸는데",
        "요청드린",
        "확인",
        "확인해",
        "확인해주세요",
        "주세요",
        "가능",
        "가능한가요",
        "가능한지",
        "개월",
        "되는",
        "되나요",
        "합니다",
        "맞습니다",
        "맞아요",
        "전화드렸",
        "전화드렸는데",
        "그러는데",
        "들어간",
        "있을텐데",
        "상태죠",
        "체크",
        "그때",
        "때는",
        "대로",
        "래서",
        "무슨",
        "보통",
        "뭐지",
        "뭐예",
        "뭐예요",
        "뭐에요",
        "뭔지",
        "무엇",
        "어느",
        "하는데",
        "해주세요",
        "해주실",
        "해주시면",
        "있습니다",
        "없습니다",
        "고객",
        "고객님",
        "상담",
        "상담한",
        "상담하신",
        "상담하",
        "상담사",
        "손님",
        "안녕하세요",
        "감사합니다",
        "갑사합니다",
        "확인해보겠습니다",
        "고객님께서",
        "궁금한",
        "궁금한게",
        "궁금",
        "질문",
        "정보들",
        "품목별",
        "간단하게",
        "안하게",
        "주시겠어",
        "보내주시겠어",
        "주시고",
        "나머지",
        "어저께",
        "했다는데",
        "그랬는데",
        "받았는데",
        "왔는데",
        "사용해가지고",
        "요청해가지고",
        "그래가지고",
        "처리했는데",
        "싶어서",
        "그걸",
        "같은데",
        "새로",
        "만들",
        "내고",
        "예전",
        "전에",
        "나간다",
        "같이",
        "티비쪽",
        "있으세",
        "일은",
        "쌓이",
        "들어",
        "일로",
        "인가",
        "생기면",
        "생기",
        "여쭤보려고",
        "여쭤보면",
        "여쭤",
        "보려고",
        "가려고",
        "원해",
        "이용하",
        "통해",
        "있으면",
        "같아요",
        "같은",
        "같이",
        "경우",
        "경우에는",
        "그냥",
        "그것",
        "언제든지",
        "문의해",
        "주시면",
        "주신",
        "저희가",
        "확인이",
        "확인을",
        "걸로",
        "이제",
        "다시",
        "싶어요",
        "싶습니다",
        "말씀해",
        "말씀",
        "있는",
        "있는데",
        "있도록",
        "해당",
        "현재",
        "자동",
        "됩니다",
        "되세요",
        "확인되세요",
        "문의합니다",
        "부탁드립니다",
        "부탁드려",
        "어떤",
        "어떻게",
        "어디서",
        "언제",
        "아니면",
        "드리겠습니다",
        "도와드리겠습니다",
        "도와드릴게요",
        "드릴게요",
        "드릴게",
        "연락드릴게",
        "연락",
        "전화",
        "전화로",
        "동의하십니까",
        "규정에",
        "따라",
        "가지고",
        "해가지고",
        "전화해가지고",
        "mobile_number",
        "personal_name",
        "charge",
        "date",
        "time",
        "name",
        "number",
        "hour",
        "일단",
        "일이",
        "내가",
        "나와",
        "나오",
        "많이",
        "함께",
        "점이",
        "답변",
        "사항은",
        "있나",
        "있으시면",
        "조건인",
        "달에",
        "월",
        "월에",
        "이번",
        "중에",
        "정도",
        "여부",
        "하나",
        "아니",
        "그렇게",
        "아직",
        "미정",
        "상태",
        "이겠으나",
        "수와",
        "일까지",
        "일부터",
        "일에",
        "이겠으나",
        "상태이겠으나",
        "바꿀",
        "바꾸",
        "바꾸는",
        "하기로",
        "할게",
        "할께",
        "할까",
        "하겠",
        "한번",
        "추가로",
        "쓰고",
        "잠시",
        "도움",
        "도와",
        "핸드폰",
        "고민",
        "갖고",
        "거기",
        "그거",
        "그것",
        "저거",
        "몰라",
        "원이",
        "적이",
        "저렴한",
        "여부를",
        "확인한",
        "확인된",
        "관련해서",
        "확인해보고",
        "후에",
        "좋을까",
        "곳이",
        "싶은데",
        "싶어",
        "싶은",
        "알겠어",
        "많이",
        "이게",
        "이렇게",
        "되는데",
        "되죠",
        "없어",
        "좋은",
        "좋고",
        "남아",
        "해서",
        "아이",
        "주세",
        "그러면",
        "아마",
        "그래",
        "그니깐",
        "그니까",
        "볼게",
        "거예",
        "거죠",
        "이거",
        "알겠습니다",
        "알았습니다",
        "감사",
        "그런데",
        "고맙습니다",
        "그렇군",
        "그렇군요",
        "그렇구나",
        "그렇죠",
        "그런",
        "그러",
        "건강",
        "고생",
        "뭐니",
        "뭐야",
        "보통",
        "바라겠습니다",
        "바라겠",
        "괜찮아",
        "괜찮아요",
        "그게",
        "아니에",
        "아니에요",
        "사항",
        "수고하세요",
        "수고했습니다",
        "수고하셨",
        "수고하십니다",
        "수고하십시오",
        "없으실까",
        "없으실까요",
        "없으세",
        "여보세",
        "여보세요",
        "얘기인지",
        "이어가세요",
        "이어가십시오",
        "연결해",
        "일상",
        "일상의",
        "이요",
        "즐거운",
        "저기",
        "여기",
        "요청확인",
        "기준확인",
        "정보수집",
        "결과안내",
        "상담원이관",
        "문제확인",
        "예외검토",
        "흐름",
        "미분류",
        "검토",
        "주말",
        "잠시만",
        "드리겠습니다",
        "드립니다",
        "드려요",
        "드렸어",
        "해놓게",
        "보내십시오",
        "필요한",
        "정리해서",
        "대해",
        "어제",
        "여기서",
        "진행",
        "진행하려면",
        "진행하면",
        "진행하고",
        "있어서",
        "있으면",
        "있으면요",
        "있는지",
        "있으시면",
        "있습니다",
        "있어",
        "적용되지",
        "않으면",
        "않는",
        "아니라",
        "생각",
        "생각하고",
        "후에",
        "다양하네",
        "차이",
        "어느",
        "정도",
        "얼마",
        "알아봐주세",
        "알아봐주세요",
        "알고",
        "정보",
        "하고",
        "받을",
        "받은",
        "받고",
        "받아서",
        "보내고",
        "보내야",
        "보내드릴게",
        "보내드릴게요",
        "할까",
        "주실",
        "으로",
        "로",
        "메일",
        "메일로",
        "이메일",
        "동안",
        "마지막",
        "나면",
        "해야",
        "부탁",
        "얼마입니까",
        "입니까",
        "맞아",
        "맞아요",
        "갑자기",
        "때문에",
        "됐는데",
        "쓰고",
        "있고",
        "있겠네",
        "해야되나",
        "물어",
        "죄송해",
        "죄송",
        "자꾸",
        "저한테",
        "가지만",
        "분",
        "분은",
        "분이",
        "분을",
        "분한테",
        "안낸",
        "없는데",
        "제를",
        "보니",
        "당연히",
        "얘기",
        "말",
        "말을",
        "말은",
        "말이",
        "나오더라고",
        "있죠",
        "드리면",
        "모르고",
        "있던",
        "부분이어서",
        "부분",
        "돼요",
        "제일",
        "가서",
        "들어왔어",
        "말고",
        "올려",
        "대강",
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
        "일요일",
        "많은",
        "기다릴게",
        "기다릴게요",
        "기다리",
        "해야",
        "되면",
        "진행되나",
        "있을까",
        "있을까요",
        "나온다니까",
        "곧바",
        "곧바로",
        "있나요",
        "없나요",
        "될까요",
        "하나요",
        "이제",
        "근데",
        "것",
        "것만",
        "값",
        "값이",
        "하려구",
        "하려구요",
        "하니까",
        "확인하니까",
        "받아",
        "받아서",
        "문의입니다",
        "하군",
        "너무",
        "요거",
        "이런",
        "저런",
        "사이",
        "한지",
        "주실",
        "사는",
        "있다고",
        "왔었는데",
        "바꾸긴",
        "잘된",
        "잘됨",
        "작년",
        "지난해",
        "올해",
        "드는",
        "될지",
        "되게끔",
        "모르겠",
        "모르겠네",
        "가능하군",
        "오르",
        "오르는",
        "오르겠",
        "오르겠죠",
        "내야",
        "아니면",
        "원래",
        "오긴",
        "제대",
        "어렵다고",
        "방금",
        "주십시오",
        "동의합니다",
        "고마워",
        "바꿔",
        "들어가",
        "들어가고",
        "들어간",
        "카드번호",
        "전화번호",
        "휴대폰번호",
        "핸드폰번호",
        "계좌번호",
        "주문번호",
        "예약번호",
        "고객번호",
        "번호",
        "연락처",
        "mobile",
        "phone",
        "email",
        "address",
        "account",
        "amount",
        "birth",
        "birth_number",
        "card_number",
        "order_id",
        "person",
        "placeholder",
    }
)
_TOKEN_PATTERN = r"(?u)\b[^\W\d_][^\W_]{1,}\b"
_LABEL_SUFFIXES = (
    "으로부터",
    "으로는",
    "으로서",
    "으로써",
    "입니다",
    "이에요",
    "예요",
    "인데요",
    "인데",
    "드릴게",
    "에서",
    "에게",
    "의",
    "부터",
    "까지",
    "후에",
    "처럼",
    "라고",
    "하고",
    "으로",
    "와",
    "과",
    "에는",
    "한테",
    "한지",
    "되는",
    "되면",
    "하려면",
    "하려고",
    "하려구요",
    "하려구",
    "하니까",
    "니까",
    "받아서",
    "었다고",
    "었다",
    "었는데",
    "다고",
    "긴",
    "하십시오",
    "해보고",
    "할게",
    "할까요",
    "할까",
    "해야",
    "됐어",
    "했어",
    "볼게",
    "해서",
    "되죠",
    "된",
    "하면",
    "싶은데",
    "싶어서",
    "싶어",
    "싶은",
    "합니다",
    "습니다",
    "하고",
    "하",
    "해",
    "할",
    "거든",
    "거든요",
    "됐는데",
    "입니까",
    "려고",
    "보려고",
    "한",
    "해",
    "로",
    "을",
    "를",
    "은",
    "는",
    "이",
    "가",
    "에",
    "도",
    "만",
    "요",
)
_LOW_VALUE_LABEL_PATTERNS = (
    re.compile(r"^[a-z]{1,3}$", re.IGNORECASE),
    re.compile(r"^\d"),
    re.compile(r"^[<>\\[\\]_/]+$"),
)
_ACTION_LABEL_HINTS = (
    "변경",
    "취소",
    "해지",
    "환불",
    "신청",
    "조회",
    "발급",
    "결제",
    "청구",
    "납부",
    "이체",
    "출금",
    "예약",
    "견적",
    "인증",
    "오류",
    "문제",
    "확인",
    "구매",
    "연락",
    "가능여부",
    "정보확인",
)
_ACTION_OBJECT_AMBIGUOUS_TERMS = frozenset({"예약", "결제", "연락", "인증"})
_ACTION_TERM_SUPPORT_ALIASES = {
    "가능여부확인": (
        "가능",
        "가능한",
        "가능한가",
        "가능한지",
        "되나요",
        "될까요",
        "되는지",
        "할 수",
        "할수",
        "불가",
        "안 되",
        "안되",
        "못 하",
        "못하",
    ),
    "가능여부": (
        "가능",
        "가능한",
        "가능한가",
        "가능한지",
        "되나요",
        "될까요",
        "되는지",
        "할 수",
        "할수",
        "불가",
        "안 되",
        "안되",
        "못 하",
        "못하",
    ),
    "정보확인": ("정보", "궁금", "알고 싶", "알고싶", "알려", "안내", "문의"),
    "확인": ("확인", "조회", "상태", "내역", "어디", "언제", "알려"),
    "변경": ("변경", "바꾸", "수정", "교체"),
    "취소": ("취소", "철회"),
    "해지": ("해지", "탈퇴", "중지", "정지", "해제"),
    "환불": ("환불", "환급", "돌려받", "돌려"),
    "신청": ("신청", "등록", "접수", "가입"),
    "발급": ("발급", "재발급"),
    "결제": ("결제", "납부", "청구", "이체", "입금", "승인"),
    "청구": ("청구", "결제", "납부"),
    "납부": ("납부", "결제", "입금"),
    "이체": ("이체", "입금", "출금"),
    "출금": ("출금", "인출"),
    "예약": ("예약", "예매"),
    "견적": ("견적", "견적서"),
    "연락": ("연락", "전화", "연결", "상담원", "담당자", "이관"),
    "인증": ("인증", "본인확인", "본인 확인", "확인"),
    "오류": ("오류", "장애", "안 되", "안되", "문제"),
    "문제": ("문제", "오류", "장애", "안 되", "안되"),
    "구매": ("구매", "구입"),
}
_ACTION_INFLECTION_SUFFIXES = (
    "하다",
    "하고",
    "하려고",
    "할려고",
    "하려구요",
    "하려구",
    "하니까",
    "니까",
    "할려구요",
    "할려구",
    "할려",
    "할라",
    "할래",
    "할게",
    "할께",
    "할",
    "해",
    "했",
    "되",
    "된",
)


class ClusterResultData(TypedDict):
    cluster_id: int
    member_indices: tuple[int, ...]
    member_conv_ids: tuple[str, ...]
    exemplar_conv_ids: tuple[str, ...]
    keywords: tuple[str, ...]
    suggested_name: str
    suggested_description: str
    workflow_signal: dict[str, bool]
    quality: ClusterQuality
    review_hint: NotRequired[str | None]
    metadata: dict[str, object]


def build_cluster_results(
    valid_clusters: dict[int, list[int]],
    outlier_node_indices: set[int],
    conversations: list[ProcessedConversation],
    vectors: np.ndarray,
    centroids: dict[int, np.ndarray],
    top_keywords: int = DEFAULT_TFIDF_TOP_KEYWORDS,
    workflow_signal_keys: tuple[str, ...] = WORKFLOW_SIGNAL_KEYS,
    root_domain_profile: RootDomainProfile | None = None,
) -> tuple[list[ClusterResult], list[NovelIntentCandidate]]:
    """Return (cluster_results, novel_candidates)."""

    cluster_keywords = _class_tfidf_keywords(valid_clusters, conversations, top_keywords)
    cluster_results = [
        ClusterResult(
            **analyze_cluster(
                cluster_id,
                member_indices,
                conversations,
                vectors,
                centroids,
                top_keywords,
                workflow_signal_keys,
                root_domain_profile,
                cluster_keywords.get(cluster_id),
            )
        )
        for cluster_id, member_indices in sorted(valid_clusters.items())
        if cluster_id in centroids
    ]
    novel_candidates = _novel_intent_candidates(conversations, outlier_node_indices)
    return cluster_results, novel_candidates


def analyze_cluster(
    cluster_id: int,
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    vectors: np.ndarray,
    centroids: dict[int, np.ndarray],
    top_keywords: int = DEFAULT_TFIDF_TOP_KEYWORDS,
    workflow_signal_keys: tuple[str, ...] = WORKFLOW_SIGNAL_KEYS,
    root_domain_profile: RootDomainProfile | None = None,
    cluster_keywords: tuple[str, ...] | None = None,
) -> ClusterResultData:
    centroid = centroids[cluster_id]
    keywords = cluster_keywords or _top_keywords(member_indices, conversations, top_keywords)
    workflow_signal = _workflow_signal(member_indices, conversations, workflow_signal_keys)
    label_result = _rerank_label_candidates(cluster_id, member_indices, conversations, keywords, root_domain_profile)
    suggested_name = str(label_result["name"])
    semantic_margin = _semantic_margin(cluster_id, member_indices, vectors, centroid, centroids)
    label_score = _adjusted_label_score(_label_float(label_result, "score"), semantic_margin)
    label_result["score"] = label_score
    label_result["semanticMargin"] = semantic_margin
    label_result["semanticMarginScore"] = _semantic_margin_score(semantic_margin)
    label_result["status"] = (
        "auto_acceptable" if label_score >= 0.65 and _label_auto_acceptable(label_result) else "needs_review"
    )

    return {
        "cluster_id": cluster_id,
        "member_indices": tuple(member_indices),
        "member_conv_ids": _member_conv_ids(member_indices, conversations),
        "exemplar_conv_ids": _exemplar_indices(member_indices, centroid, vectors, conversations),
        "keywords": keywords,
        "suggested_name": suggested_name,
        "suggested_description": f"{suggested_name} 클러스터",
        "workflow_signal": workflow_signal,
        "review_hint": None if label_score >= 0.65 else "label_quality_low",
        "quality": ClusterQuality(
            interpretability_score=interpretability_score(vectors, member_indices),
            workflow_consistency_score=workflow_consistency_score(conversations, {cluster_id: member_indices}).get(
                "avg_consistency", 0.0
            ),
            branching_explainability_score=branching_explainability_score(vectors, member_indices),
        ),
        "metadata": _cluster_metadata(len(member_indices), root_domain_profile, label_result),
    }


def _exemplar_indices(
    member_indices: list[int],
    centroid: np.ndarray,
    vectors: np.ndarray,
    conversations: list[ProcessedConversation],
) -> tuple[str, ...]:
    if not member_indices:
        return ()

    centroid_norm = float(np.linalg.norm(centroid))
    if centroid_norm < 1e-9:
        return tuple(conversations[i].id for i in member_indices[:3])

    similarities = _cosine_similarities(vectors[member_indices], centroid, centroid_norm)
    ranked_positions = np.argsort(-similarities, kind="stable")[:3]
    return tuple(conversations[member_indices[int(position)]].id for position in ranked_positions)


def _top_keywords(
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    top_k: int = DEFAULT_TFIDF_TOP_KEYWORDS,
) -> tuple[str, ...]:
    texts = [
        _label_source_text(conversations[index]) for index in member_indices if _has_conversation(index, conversations)
    ]
    texts = [text for text in texts if text.strip()]
    if not texts or top_k <= 0:
        return ()

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=80,
        stop_words=list(_GENERIC_KEYWORDS),
        token_pattern=_TOKEN_PATTERN,
    )
    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
    except ValueError:
        return ()

    scores = np.asarray(tfidf_matrix.sum(axis=0), dtype=np.float64).ravel()  # pyright: ignore[reportAttributeAccessIssue]
    features = vectorizer.get_feature_names_out()
    ranked_indices = np.argsort(-scores, kind="stable")[:top_k]
    return tuple(
        keyword
        for index in ranked_indices
        if scores[int(index)] > 0.0 and (keyword := _clean_keyword(str(features[int(index)])))
    )


def _class_tfidf_keywords(
    valid_clusters: dict[int, list[int]],
    conversations: list[ProcessedConversation],
    top_k: int = DEFAULT_TFIDF_TOP_KEYWORDS,
) -> dict[int, tuple[str, ...]]:
    if not valid_clusters or top_k <= 0:
        return {}

    cluster_ids = sorted(valid_clusters)
    documents = [_cluster_label_document(valid_clusters[cluster_id], conversations) for cluster_id in cluster_ids]
    documents = [document.strip() for document in documents]
    if not any(documents):
        return {}

    vectorizer = CountVectorizer(
        ngram_range=(1, 2),
        max_features=240,
        stop_words=list(_GENERIC_KEYWORDS),
        token_pattern=_TOKEN_PATTERN,
    )
    try:
        counts_matrix = vectorizer.fit_transform(documents)
    except ValueError:
        return {}

    counts = counts_matrix.astype(np.float64).toarray()
    row_sums = counts.sum(axis=1, keepdims=True)
    if counts.shape[0] == 0 or counts.shape[1] == 0:
        return {}

    term_totals = counts.sum(axis=0)
    avg_words_per_cluster = float(row_sums.mean()) if row_sums.size else 0.0
    if avg_words_per_cluster <= 0.0:
        return {}

    tf = np.zeros_like(counts, dtype=np.float64)
    _ = np.divide(counts, row_sums, out=tf, where=row_sums > 0.0)
    tf = np.sqrt(tf)
    idf = np.log1p(avg_words_per_cluster / np.maximum(term_totals, 1.0))
    scores = tf * idf
    features = vectorizer.get_feature_names_out()

    output: dict[int, tuple[str, ...]] = {}
    for row_index, cluster_id in enumerate(cluster_ids):
        ranked_indices = np.argsort(-scores[row_index], kind="stable")
        keywords: list[str] = []
        for index in ranked_indices:
            score = float(scores[row_index, int(index)])
            if score <= 0.0:
                continue
            keyword = _clean_keyword(str(features[int(index)]))
            if not keyword or keyword in keywords:
                continue
            keywords.append(keyword)
            if len(keywords) >= top_k:
                break
        output[cluster_id] = tuple(keywords)
    return output


def _workflow_signal(
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    workflow_signal_keys: tuple[str, ...] = WORKFLOW_SIGNAL_KEYS,
) -> dict[str, bool]:
    members = [conversations[index] for index in member_indices if _has_conversation(index, conversations)]
    text = " ".join(conversation.canonical_text.casefold() for conversation in members)
    values = {
        "requires_payment_check": any(keyword in text for keyword in ("결제", "payment", "환불", "refund", "환급")),
        "requires_user_identification": any(
            keyword in text for keyword in ("본인인증", "identity", "인증", "本人인증")
        ),
        "has_escalation_cases": any(conversation.ended_status == "escalated" for conversation in members),
    }
    return {
        key: any(conversation.workflow_signal.get(key, False) for conversation in members) or values.get(key, False)
        for key in workflow_signal_keys
    }


def _cluster_label_document(member_indices: list[int], conversations: list[ProcessedConversation]) -> str:
    return " ".join(
        _label_source_text(conversations[index]) for index in member_indices if _has_conversation(index, conversations)
    ).strip()


def _label_source_text(conversation: ProcessedConversation) -> str:
    customer_text = conversation.customer_problem_text.strip()
    return customer_text or conversation.canonical_text.strip()


def _clean_keyword(keyword: str) -> str:
    words = [_clean_token(word) for word in keyword.replace("_", " ").split()]
    informative_words = _compact_label_terms([word for word in words if _is_informative_term(word)])
    cleaned = " ".join(dict.fromkeys(informative_words)).strip()
    if not cleaned or cleaned in _GENERIC_KEYWORDS:
        return ""
    if len(cleaned) <= 1:
        return ""
    if any(pattern.search(cleaned) for pattern in _LOW_VALUE_LABEL_PATTERNS):
        return ""
    return cleaned


def _clean_token(token: str) -> str:
    cleaned = re.sub(r"^[^0-9A-Za-z가-힣]+|[^0-9A-Za-z가-힣]+$", "", token).strip()
    if not cleaned:
        return ""
    normalized_query_term = _normalize_query_value_keyword(cleaned)
    if normalized_query_term:
        return normalized_query_term
    if cleaned.casefold() in _GENERIC_KEYWORDS:
        return ""
    for _ in range(3):
        before = cleaned
        for suffix in _LABEL_SUFFIXES:
            if not cleaned.endswith(suffix):
                continue
            root = cleaned[: -len(suffix)]
            min_root_length = 1 if len(suffix) > 1 else 2
            if len(root) >= min_root_length:
                cleaned = root
                break
        if cleaned == before:
            break
    cleaned = _normalize_action_inflected_keyword(cleaned)
    normalized_query_term = _normalize_query_value_keyword(cleaned)
    if normalized_query_term:
        return normalized_query_term
    if cleaned.casefold() in _GENERIC_KEYWORDS:
        return ""
    return cleaned


def _normalize_query_value_keyword(term: str) -> str:
    normalized = term.casefold()
    if normalized.startswith("얼마"):
        return "금액"
    if normalized.startswith("얼만"):
        return "금액"
    if normalized.startswith("돈"):
        return "금액"
    if normalized.startswith("값"):
        return "금액"
    if normalized.startswith("인출"):
        return "출금"
    if normalized.startswith("출금"):
        return "출금"
    if normalized.startswith("초과"):
        return "초과"
    return ""


def _normalize_action_inflected_keyword(term: str) -> str:
    for action in _ACTION_LABEL_HINTS:
        if term == action:
            return term
        if not term.startswith(action):
            continue
        remainder = term[len(action) :]
        if remainder and any(remainder.startswith(suffix) for suffix in _ACTION_INFLECTION_SUFFIXES):
            return action
    return term


def _is_informative_term(term: str) -> bool:
    if not term or term in _GENERIC_KEYWORDS:
        return False
    if len(term) <= 1:
        return False
    if any(pattern.search(term) for pattern in _LOW_VALUE_LABEL_PATTERNS):
        return False
    return True


def _suggested_name(
    cluster_id: int,
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    keywords: tuple[str, ...],
    root_domain_profile: RootDomainProfile | None = None,
) -> str:
    del member_indices, conversations, root_domain_profile
    label_terms = _label_terms(keywords)
    if not label_terms:
        return f"미분류_{cluster_id}"
    return f"{' / '.join(label_terms)} 문의"


def _rerank_label_candidates(
    cluster_id: int,
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    keywords: tuple[str, ...],
    root_domain_profile: RootDomainProfile | None = None,
) -> dict[str, object]:
    candidates = _label_candidates(cluster_id, member_indices, conversations, keywords, root_domain_profile)
    if not candidates:
        fallback = f"미분류_{cluster_id}"
        return {
            "name": fallback,
            "score": 0.0,
            "evidenceCoverage": 0.0,
            "memberEvidenceCoverage": 0.0,
            "termEvidenceCoverage": 0.0,
            "objectCoverage": 0.0,
            "actionCoverage": 0.0,
            "objectActionJointCoverage": 0.0,
            "actionObjectValidity": 0.0,
            "status": "needs_review",
            "candidates": [{"name": fallback, "score": 0.0, "source": "fallback"}],
        }

    evidence_text = _cluster_label_document(member_indices, conversations)
    member_texts = [
        _label_source_text(conversations[index]) for index in member_indices if _has_conversation(index, conversations)
    ]
    scored = [
        {
            "name": candidate["name"],
            "source": candidate["source"],
            **_score_label(str(candidate["name"]), evidence_text, member_texts, keywords),
        }
        for candidate in candidates
    ]
    scored.sort(key=lambda item: (-_label_float(item, "score"), str(item["name"])))
    best = scored[0]
    best_score = _label_float(best, "score")
    return {
        "name": best["name"],
        "score": best["score"],
        "evidenceCoverage": best["evidenceCoverage"],
        "memberEvidenceCoverage": best["memberEvidenceCoverage"],
        "termEvidenceCoverage": best["termEvidenceCoverage"],
        "objectCoverage": best["objectCoverage"],
        "actionCoverage": best["actionCoverage"],
        "objectActionJointCoverage": best["objectActionJointCoverage"],
        "actionObjectValidity": best["actionObjectValidity"],
        "status": "auto_acceptable" if best_score >= 0.65 and _label_auto_acceptable(best) else "needs_review",
        "candidates": scored[:5],
    }


def _label_candidates(
    cluster_id: int,
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    keywords: tuple[str, ...],
    root_domain_profile: RootDomainProfile | None,
) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    action_object_candidate = _action_object_label_candidate(member_indices, conversations)
    if action_object_candidate:
        candidates.append(action_object_candidate)
    base_name = _suggested_name(cluster_id, member_indices, conversations, keywords, root_domain_profile)
    if base_name:
        candidates.append({"name": base_name, "source": "ctfidf"})
    candidates.extend(_dominant_action_keyword_label_candidates(member_indices, conversations, keywords))
    for object_term, action in _keyword_object_action_candidates(keywords)[:4]:
        candidates.append(
            {
                "name": _ensure_inquiry_suffix(f"{object_term} {action}"),
                "source": "keyword_object_action",
            }
        )
    for action in _keyword_action_candidates(keywords)[:2]:
        candidates.append({"name": _ensure_inquiry_suffix(action), "source": "action_term"})
    return _unique_label_candidates(candidates)


def _keyword_object_action_candidates(keywords: tuple[str, ...]) -> list[tuple[str, str]]:
    candidates: list[tuple[str, str]] = []
    for keyword in keywords:
        cleaned = _clean_keyword(keyword)
        if not cleaned:
            continue
        action = _canonical_action_term(cleaned)
        if not action:
            continue
        object_terms = [term for term in cleaned.split() if _is_object_label_term(term)]
        if not object_terms:
            continue
        object_term = " ".join(object_terms[:3])
        if object_term and object_term != action and action not in object_term:
            candidates.append((object_term, action))
    return _dedupe_object_action_candidates(candidates)


def _keyword_action_candidates(keywords: tuple[str, ...]) -> list[str]:
    actions: list[str] = []
    for keyword in keywords:
        action = _canonical_action_term(keyword)
        if action and action not in actions:
            actions.append(action)
    return actions


def _dominant_action_keyword_label_candidates(
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    keywords: tuple[str, ...],
) -> list[dict[str, str]]:
    action = _dominant_frame_action(member_indices, conversations)
    if not action:
        return []
    object_terms = _keyword_label_object_terms(keywords)
    candidates: list[dict[str, str]] = []
    for object_term in object_terms[:3]:
        if action in object_term:
            continue
        candidates.append(
            {
                "name": _ensure_inquiry_suffix(f"{object_term} {action}"),
                "source": "dominant_action_keyword",
            }
        )
    return candidates


def _dominant_frame_action(member_indices: list[int], conversations: list[ProcessedConversation]) -> str:
    counts: Counter[str] = Counter()
    for index in member_indices:
        if not _has_conversation(index, conversations):
            continue
        frame = conversations[index].metadata.get("actionObjectFrame")
        if not isinstance(frame, dict) or _frame_confidence(frame) < 0.55:
            continue
        action = _frame_value(frame, "action")
        if action and not _is_weak_action_term(action):
            counts[action] += 1
    if not counts:
        return ""
    action, support = counts.most_common(1)[0]
    support_ratio = support / len(member_indices) if member_indices else 0.0
    return action if support >= 2 and support_ratio >= 0.30 else ""


def _keyword_label_object_terms(keywords: tuple[str, ...]) -> list[str]:
    output: list[str] = []
    for keyword in keywords:
        cleaned = _clean_keyword(keyword)
        if not cleaned:
            continue
        terms = [term for term in cleaned.split() if _is_object_label_term(term)]
        object_term = " ".join(terms[:3]).strip()
        if object_term:
            _append_label_term(output, object_term)
        if len(output) >= 4:
            break
    return output


def _canonical_action_term(value: str) -> str:
    cleaned = _clean_keyword(value)
    if not cleaned:
        return ""
    for term in cleaned.split():
        action = _action_hint_for_term(term)
        if action:
            return action
    return _action_hint_for_term(cleaned)


def _action_hint_for_term(term: str) -> str:
    normalized = term.casefold()
    for hint in _ACTION_LABEL_HINTS:
        if hint in normalized:
            return hint
    return ""


def _is_object_label_term(term: str) -> bool:
    cleaned = _clean_keyword(term)
    if not cleaned or _is_weak_label_term(cleaned):
        return False
    return not _action_hint_for_term(cleaned)


def _dedupe_object_action_candidates(candidates: list[tuple[str, str]]) -> list[tuple[str, str]]:
    output: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for object_term, action in candidates:
        key = (object_term, action)
        if key in seen:
            continue
        seen.add(key)
        output.append(key)
    return output


def _action_object_label_candidate(
    member_indices: list[int],
    conversations: list[ProcessedConversation],
) -> dict[str, str]:
    counts: Counter[tuple[str, str]] = Counter()
    for index in member_indices:
        frame = conversations[index].metadata.get("actionObjectFrame")
        if not isinstance(frame, dict):
            continue
        if _frame_confidence(frame) < 0.65:
            continue
        object_term = _frame_object_value(frame)
        action = _frame_value(frame, "action")
        if not object_term or not action or _is_weak_label_term(object_term) or _is_weak_action_term(action):
            continue
        counts[(object_term, action)] += 1
    if not counts:
        return {}
    (object_term, action), _support = counts.most_common(1)[0]
    support_ratio = _support / len(member_indices) if member_indices else 0.0
    if _support < 2 or support_ratio < 0.25:
        return {}
    if action in object_term:
        return {"name": _ensure_inquiry_suffix(object_term), "source": "action_object_frame"}
    return {"name": _ensure_inquiry_suffix(f"{object_term} {action}"), "source": "action_object_frame"}


def _frame_value(frame: dict[object, object], key: str) -> str:
    value = frame.get(key)
    return str(value).strip().casefold() if isinstance(value, str) else ""


def _frame_object_value(frame: dict[object, object]) -> str:
    value = _frame_value(frame, "object")
    terms: list[str] = []
    for raw_term in re.findall(r"[0-9A-Za-z가-힣_]+", value):
        cleaned = _clean_keyword(raw_term)
        if not cleaned:
            continue
        for term in cleaned.split():
            if not _is_weak_label_term(term) and term not in terms:
                terms.append(term)
    return " ".join(_compact_label_terms(terms)[:4])


def _frame_confidence(frame: dict[object, object]) -> float:
    value = frame.get("confidence")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return max(0.0, min(1.0, float(value)))
    return 0.0


def _score_label(
    label: str,
    evidence_text: str,
    member_texts: list[str],
    keywords: tuple[str, ...],
) -> dict[str, float]:
    terms = _label_core_terms(label)
    term_evidence_coverage = _evidence_term_coverage(terms, evidence_text)
    member_evidence_coverage = _member_evidence_coverage(terms, member_texts)
    object_terms, action_terms = _label_object_action_terms(terms)
    object_coverage = _component_member_coverage(object_terms, member_texts)
    action_coverage = _component_member_coverage(action_terms, member_texts)
    object_action_joint_coverage = _object_action_joint_coverage(object_terms, action_terms, member_texts)
    evidence_coverage = (
        (0.20 * term_evidence_coverage) + (0.30 * member_evidence_coverage) + (0.50 * object_action_joint_coverage)
    )
    action_validity = _action_object_validity(label, terms)
    readability = _label_readability_score(label)
    keyword_grounding = _keyword_grounding_score(terms, keywords)
    contamination = _label_contamination_score(label, terms)
    specificity = _label_specificity_score(label, terms)
    score = (
        0.24 * evidence_coverage
        + 0.22 * action_validity
        + 0.18 * object_action_joint_coverage
        + 0.12 * readability
        + 0.08 * keyword_grounding
        + 0.08 * contamination
        + 0.08 * specificity
    )
    if member_evidence_coverage < 0.35:
        score *= 0.78
    if object_action_joint_coverage < 0.25:
        score *= 0.82
    return {
        "score": round(min(1.0, score), 4),
        "evidenceCoverage": round(evidence_coverage, 4),
        "termEvidenceCoverage": round(term_evidence_coverage, 4),
        "memberEvidenceCoverage": round(member_evidence_coverage, 4),
        "objectCoverage": round(object_coverage, 4),
        "actionCoverage": round(action_coverage, 4),
        "objectActionJointCoverage": round(object_action_joint_coverage, 4),
        "actionObjectValidity": round(action_validity, 4),
        "readability": round(readability, 4),
        "keywordGrounding": round(keyword_grounding, 4),
        "contamination": round(contamination, 4),
        "specificity": round(specificity, 4),
    }


def _label_auto_acceptable(payload: dict[str, object]) -> bool:
    member_coverage = _label_float(payload, "memberEvidenceCoverage")
    object_action_joint_coverage = _label_float(payload, "objectActionJointCoverage")
    action_validity = _label_float(payload, "actionObjectValidity")
    contamination = _label_float(payload, "contamination")
    readability = _label_float(payload, "readability")
    specificity = _label_float(payload, "specificity")
    return (
        member_coverage >= 0.45
        and object_action_joint_coverage >= 0.35
        and action_validity >= 0.55
        and contamination >= 0.75
        and readability >= 0.45
        and specificity >= 0.50
    )


def _action_object_validity(label: str, terms: tuple[str, ...]) -> float:
    if not terms:
        return 0.0
    has_action = any(hint in label for hint in _ACTION_LABEL_HINTS)
    has_object = len(terms) >= 2
    if has_action and has_object:
        return 1.0
    if has_action:
        return 0.45
    if has_object:
        return 0.55
    return 0.25


def _label_core_terms(label: str) -> tuple[str, ...]:
    normalized = label.replace("/", " ").replace("문의", " ")
    return tuple(
        term
        for raw in normalized.split()
        if (term := _clean_keyword(raw)) and (term not in _GENERIC_KEYWORDS or _action_hint_for_term(term))
    )


def _evidence_term_coverage(terms: tuple[str, ...], evidence_text: str) -> float:
    if not terms:
        return 0.0
    normalized = evidence_text.casefold()
    supported = sum(1 for term in terms if _term_supported_by_text(normalized, term))
    return supported / len(terms)


def _member_evidence_coverage(terms: tuple[str, ...], member_texts: list[str]) -> float:
    if not terms or not member_texts:
        return 0.0
    scores: list[float] = []
    normalized_terms = tuple(term.casefold() for term in terms)
    for text in member_texts:
        normalized = text.casefold()
        hits = sum(1 for term in normalized_terms if _term_supported_by_text(normalized, term))
        scores.append(hits / len(normalized_terms))
    return float(np.mean(np.asarray(scores, dtype=np.float32))) if scores else 0.0


def _label_object_action_terms(terms: tuple[str, ...]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    action_terms = tuple(term for term in terms if _action_hint_for_term(term))
    object_terms = tuple(term for term in terms if term not in action_terms and not _is_weak_label_term(term))
    if not object_terms and len(action_terms) == 1 and action_terms[0] in _ACTION_OBJECT_AMBIGUOUS_TERMS:
        return action_terms, ()
    if not object_terms and len(action_terms) >= 2:
        return action_terms[:-1], action_terms[-1:]
    return object_terms, action_terms


def _component_member_coverage(component_terms: tuple[str, ...], member_texts: list[str]) -> float:
    if not component_terms or not member_texts:
        return 0.0
    scores = [1.0 if _text_supports_any_term(text, component_terms) else 0.0 for text in member_texts if text.strip()]
    return float(np.mean(np.asarray(scores, dtype=np.float32))) if scores else 0.0


def _object_action_joint_coverage(
    object_terms: tuple[str, ...],
    action_terms: tuple[str, ...],
    member_texts: list[str],
) -> float:
    if not action_terms or not member_texts:
        return 0.0
    if not object_terms:
        return _component_member_coverage(action_terms, member_texts)
    scores = [
        1.0 if _text_supports_any_term(text, object_terms) and _text_supports_any_term(text, action_terms) else 0.0
        for text in member_texts
        if text.strip()
    ]
    return float(np.mean(np.asarray(scores, dtype=np.float32))) if scores else 0.0


def _text_supports_any_term(text: str, terms: tuple[str, ...]) -> bool:
    normalized = text.casefold()
    return any(_term_supported_by_text(normalized, term) for term in terms)


def _term_supported_by_text(normalized_text: str, term: str) -> bool:
    normalized_term = term.casefold()
    if normalized_term in normalized_text:
        return True
    aliases = _ACTION_TERM_SUPPORT_ALIASES.get(normalized_term)
    if aliases and any(alias in normalized_text for alias in aliases):
        return True
    if normalized_term == "정보확인":
        return "정보" in normalized_text or "확인" in normalized_text
    if normalized_term == "가능여부":
        return "가능" in normalized_text or "여부" in normalized_text
    return False


def _label_readability_score(label: str) -> float:
    if not label.endswith("문의"):
        return 0.35
    if "/" in label or "미분류" in label:
        return 0.45
    if any(
        term in label
        for term in (
            "언제든지",
            "주세요",
            "좋을까",
            "곳이",
            "싶은데",
            "수고",
            "갑사",
            "나온다니까",
            "곧바",
            "주세",
            "그러면",
            "아마",
            "그래",
            "지금",
            "맞습니다",
            "전화드렸",
            "그러는데",
            "요청확인",
            "기준확인",
            "미분류",
            "검토",
        )
    ):
        return 0.35
    if len(label) > 28:
        return 0.55
    if len(label.strip()) <= 4:
        return 0.40
    return 1.0


def _label_contamination_score(label: str, terms: tuple[str, ...]) -> float:
    if not terms:
        return 0.0
    normalized = label.casefold()
    if any(term in normalized for term in ("mobile_number", "personal_name", "card_number", "order_id")):
        return 0.0
    contaminated_terms = sum(1 for term in terms if term.casefold() in _GENERIC_KEYWORDS)
    if contaminated_terms:
        return max(0.0, 1.0 - contaminated_terms / len(terms))
    return 1.0


def _label_specificity_score(label: str, terms: tuple[str, ...]) -> float:
    if not terms:
        return 0.0
    if any(_is_weak_label_term(term) for term in terms):
        return 0.25
    has_action = any(hint in label for hint in _ACTION_LABEL_HINTS)
    has_object = len(terms) >= 2
    if has_object and has_action:
        return 1.0
    if has_object and len(terms) >= 2:
        return 0.65
    if has_action:
        return 0.25
    return 0.45


def _is_weak_label_term(term: str) -> bool:
    normalized = _clean_keyword(term)
    if not normalized:
        return True
    if normalized in _GENERIC_KEYWORDS:
        return True
    return any(
        weak in normalized
        for weak in (
            "문의드",
            "부탁",
            "가능한",
            "가능할",
            "알겠",
            "요청드",
            "있을까",
            "있나요",
            "없나요",
            "될까요",
            "하나요",
            "연락드릴",
            "연락",
            "전화",
            "도움",
            "진행하려",
            "어떻게",
            "언제",
            "어디",
        )
    )


def _is_weak_action_term(term: str) -> bool:
    normalized = term.strip().casefold()
    if not normalized:
        return True
    return not any(hint in normalized for hint in _ACTION_LABEL_HINTS)


def _keyword_grounding_score(terms: tuple[str, ...], keywords: tuple[str, ...]) -> float:
    if not terms:
        return 0.0
    normalized_keywords = " ".join(keywords).casefold()
    grounded = sum(1 for term in terms if term.casefold() in normalized_keywords)
    return grounded / len(terms)


def _ensure_inquiry_suffix(value: str) -> str:
    normalized = " ".join(value.split()).strip()
    if not normalized:
        return ""
    return normalized if normalized.endswith("문의") else f"{normalized} 문의"


def _unique_label_candidates(candidates: list[dict[str, str]]) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    seen: set[str] = set()
    for candidate in candidates:
        name = candidate["name"].strip()
        if not name or name in seen:
            continue
        seen.add(name)
        output.append({"name": name, "source": candidate["source"]})
    return output


def _label_float(payload: dict[str, object], key: str) -> float:
    value = payload.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return 0.0


def _semantic_margin(
    cluster_id: int,
    member_indices: list[int],
    vectors: np.ndarray,
    centroid: np.ndarray,
    centroids: dict[int, np.ndarray],
) -> float:
    if not member_indices:
        return 0.0
    centroid_norm = float(np.linalg.norm(centroid))
    if centroid_norm <= 1e-9:
        return 0.0
    cohesion = float(np.mean(_cosine_similarities(vectors[member_indices], centroid, centroid_norm)))
    nearest = max(
        (
            float(centroid @ other / max(centroid_norm * float(np.linalg.norm(other)), 1e-9))
            for other_id, other in centroids.items()
            if other_id != cluster_id
        ),
        default=0.0,
    )
    return round(cohesion - nearest, 6)


def _semantic_margin_score(margin: float) -> float:
    return max(0.0, min(1.0, (margin + 0.02) / 0.12))


def _adjusted_label_score(raw_score: float, semantic_margin: float) -> float:
    margin_score = _semantic_margin_score(semantic_margin)
    return round((0.78 * raw_score) + (0.22 * margin_score), 4)


def _label_terms(keywords: tuple[str, ...], max_terms: int = 2) -> tuple[str, ...]:
    ranked_keywords = sorted(
        ((_clean_keyword(keyword), index) for index, keyword in enumerate(keywords)),
        key=lambda item: (_label_term_penalty(item[0]), item[1]),
    )
    terms: list[str] = []
    for cleaned, _index in ranked_keywords:
        if not cleaned:
            continue
        _append_label_term(terms, cleaned)
        if len(terms) >= max_terms:
            break
    return tuple(terms)


def _compact_label_terms(terms: list[str]) -> list[str]:
    compacted: list[str] = []
    for term in terms:
        if not _is_informative_term(term):
            continue
        if any(term == existing for existing in compacted):
            continue
        if any(term in existing and len(existing) > len(term) for existing in compacted):
            continue
        compacted = [existing for existing in compacted if not (existing in term and len(term) > len(existing))]
        compacted.append(term)
    return compacted


def _append_label_term(terms: list[str], candidate: str) -> None:
    for index, existing in enumerate(terms):
        if candidate == existing or candidate in existing:
            return
        if existing in candidate:
            terms[index] = candidate
            return
    terms.append(candidate)


def _label_term_penalty(term: str) -> int:
    if not term:
        return 100
    penalty = 0
    if any(char.isdigit() for char in term):
        penalty += 8
    if len(term) > 14:
        penalty += 2
    if " " in term and not any(hint in term for hint in _ACTION_LABEL_HINTS):
        penalty += 1
    if any(hint in term for hint in _ACTION_LABEL_HINTS):
        penalty -= 3
    if " " in term and any(hint in term for hint in _ACTION_LABEL_HINTS):
        penalty -= 2
    return penalty


def _cluster_metadata(
    cluster_size: int,
    root_domain_profile: RootDomainProfile | None,
    label_result: dict[str, object],
) -> dict[str, object]:
    metadata: dict[str, object] = {
        "cluster_size": cluster_size,
        "label_source": "reranked_evidence_candidates",
        "label_score": label_result["score"],
        "label_evidence_coverage": label_result["evidenceCoverage"],
        "label_member_evidence_coverage": label_result.get("memberEvidenceCoverage"),
        "label_object_coverage": label_result.get("objectCoverage"),
        "label_action_coverage": label_result.get("actionCoverage"),
        "label_object_action_joint_coverage": label_result.get("objectActionJointCoverage"),
        "label_action_object_validity": label_result.get("actionObjectValidity"),
        "label_embedding_margin": label_result["semanticMargin"],
        "label_embedding_margin_score": label_result["semanticMarginScore"],
        "label_validation_status": label_result["status"],
        "label_candidates": label_result["candidates"],
    }
    if root_domain_profile is not None:
        metadata["root_domain"] = root_domain_profile.root_domain
        metadata["root_domain_confidence"] = root_domain_profile.confidence
    return metadata


def _novel_intent_candidates(
    conversations: list[ProcessedConversation],
    outlier_indices: set[int],
    min_size: int = 3,
) -> list[NovelIntentCandidate]:
    groups_by_level: list[dict[str, list[int]]] = [defaultdict(list), defaultdict(list), defaultdict(list)]
    group_names_by_level: list[dict[str, str]] = [{}, {}, {}]
    group_sources_by_level: list[dict[str, str]] = [{}, {}, {}]
    for index in sorted(outlier_indices):
        if not _has_conversation(index, conversations):
            continue
        conversation = conversations[index]
        for level, (group_key, source_type, suggested_name) in enumerate(_novel_group_options(conversation)):
            groups_by_level[level][group_key].append(index)
            group_names_by_level[level][group_key] = suggested_name
            group_sources_by_level[level][group_key] = source_type

    candidates: list[NovelIntentCandidate] = []
    assigned: set[int] = set()
    for level, grouped_indices in enumerate(groups_by_level):
        for group_key, raw_indices in sorted(grouped_indices.items()):
            indices = [index for index in raw_indices if index not in assigned]
            if len(indices) < min_size:
                continue
            source_type = group_sources_by_level[level].get(group_key, "outlier_group")
            candidates.append(
                NovelIntentCandidate(
                    candidate_key=f"{source_type}:{group_key}:{len(indices)}",
                    source_type=source_type,
                    candidate_size=len(indices),
                    suggested_name=group_names_by_level[level].get(group_key, "미분류 문의"),
                    member_conv_ids=_member_conv_ids(indices, conversations),
                )
            )
            assigned.update(indices)
    return candidates


def _novel_group_options(conversation: ProcessedConversation) -> tuple[tuple[str, str, str], ...]:
    options: list[tuple[str, str, str]] = []
    frame = conversation.metadata.get("actionObjectFrame")
    if isinstance(frame, dict) and _frame_confidence(frame) >= 0.65:
        object_term = _frame_object_value(frame)
        action = _frame_value(frame, "action")
        if object_term and action and not _is_weak_label_term(object_term) and not _is_weak_action_term(action):
            name = _ensure_inquiry_suffix(object_term if action in object_term else f"{object_term} {action}")
            options.append((f"{object_term}:{action}", "outlier_frame", name))

    sequence = tuple(event for event in _collapsed_novel_events(conversation.flow_events)[:2] if event)
    if sequence:
        sequence_key = ">".join(sequence)
        options.append((sequence_key, "outlier_flow", "관측 흐름 미분류 문의"))

    status = conversation.ended_status or conversation.channel or "unknown"
    options.append((status, "outlier_status", f"{status} 미분류 문의"))
    return tuple(options)


def _collapsed_novel_events(events: tuple[str, ...]) -> tuple[str, ...]:
    output: list[str] = []
    for event in events:
        if event and (not output or output[-1] != event):
            output.append(event)
    return tuple(output)


def _cosine_similarities(member_vectors: np.ndarray, centroid: np.ndarray, centroid_norm: float) -> np.ndarray:
    values = member_vectors.astype(np.float32, copy=False)
    norms = np.linalg.norm(values, axis=1)
    similarities = np.zeros((values.shape[0],), dtype=np.float32)
    _ = np.divide(values @ centroid, norms * centroid_norm, out=similarities, where=norms > 0.0)
    return similarities


def _member_conv_ids(member_indices: list[int], conversations: list[ProcessedConversation]) -> tuple[str, ...]:
    return tuple(conversations[index].id for index in member_indices if _has_conversation(index, conversations))


def _has_conversation(index: int, conversations: list[ProcessedConversation]) -> bool:
    return 0 <= index < len(conversations)


__all__ = [
    "analyze_cluster",
    "build_cluster_results",
]
