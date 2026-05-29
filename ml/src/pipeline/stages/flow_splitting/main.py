from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, cast

import numpy as np

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context

CLUSTERS_ARTIFACT = "clusters.json"
WORKFLOW_ENTRYPOINTS_ARTIFACT = "workflow_entrypoints.json"
FLOW_SPLIT_REPORT_ARTIFACT = "flow_split_report.json"
MIN_SPLIT_SIZE = 5
EXPANDED_MIN_SPLIT_SIZE = 3
LOW_QUALITY_CLUSTER_DROP_RATIO = 0.80
NOVEL_REVIEW_CANDIDATE_MIN_SIZE = 3
FLOW_SPLIT_STRATEGIES = {"conservative", "signal", "expanded"}
SEQUENCE_SPLIT_PREFIX = "sequence:"
ACTION_OBJECT_SPLIT_PREFIX = "action_object:"
ACTION_SPLIT_PREFIX = "action:"
COMPOUND_SPLIT_SEPARATOR = "|"
WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.70
WORKFLOW_REVIEW_CONFIDENCE_THRESHOLD = WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD
WORKFLOW_HIGH_CONFIDENCE_THRESHOLD = 0.85
WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD = 0.50
WORKFLOW_LABEL_SAMPLE_REVIEW_THRESHOLD = 0.65
MIN_ENTRYPOINT_DISTINCTIVENESS_FOR_SAMPLE = 0.18
MIN_ENTRYPOINT_MARGIN_FOR_SAMPLE = 0.0
MIN_GROUNDED_LABEL_EVIDENCE_COVERAGE = 0.25
MIN_GROUNDED_TERM_FREQUENCY_SCORE = 0.50
AUTO_SPLIT_LABEL_EVIDENCE_COVERAGE = 0.45
AUTO_SPLIT_LABEL_OBJECT_ACTION_JOINT_COVERAGE = 0.65
AUTO_SPLIT_LABEL_ACTION_OBJECT_VALIDITY = 0.70
AUTO_SPLIT_LABEL_SPECIFICITY = 0.75
AUTO_LABEL_MIN_MEMBER_COUNT = 2
AUTO_REVIEW_ONLY_ACTION_TERMS = frozenset({"정보확인"})
AUTO_GENERIC_ACTION_TERMS = frozenset({"확인", "가능여부", "가능여부확인"})
AUTO_MIN_SPECIFIC_OBJECT_LENGTH_FOR_GENERIC_ACTION = 3
AUTO_WEAK_OBJECT_TERMS = frozenset({"개월", "일", "월", "원", "건", "거", "것", "번", "정도", "부분", "내용"})
TEXT_INFERRED_ACTION_BLOCKLIST = frozenset({"인증"})
REVIEW_LABEL_SCAFFOLD_TERMS = frozenset({"문의", "검토", "근거", "부족", "라벨", "추가", "수동"})
REVIEW_PLACEHOLDER_LABEL = "미분류 문의"
ACTION_LABEL_HINTS = (
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
    "연락",
    "인증",
    "오류",
    "문제",
    "확인",
    "구매",
    "가능여부",
    "정보확인",
)
ACTION_INFLECTION_SUFFIXES = (
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
    "한",
)
FRAME_OBJECT_NOISE_TERMS = frozenset(
    {
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
        "점이",
        "나오",
        "나온",
        "건지",
        "어디",
        "어디로",
        "어디서",
        "있다",
        "하는",
        "방법",
        "해주시면",
        "보내주면",
        "만약",
        "없어서",
        "갈까",
        "까먹어서",
        "나가",
        "나가는",
        "없이",
        "저기",
        "후로",
        "바꾸",
        "바꾸었",
        "바꾸었는지",
        "바꿔",
        "것",
        "것만",
        "값",
        "값이",
        "하려구",
        "하려구요",
        "하니까",
        "확인하니까",
        "받아서",
        "받아",
        "입니다",
        "문의입니다",
        "하군",
        "있을까",
        "있을까요",
        "뭐예",
        "뭐예요",
        "뭐에요",
        "뭐지",
        "뭔지",
        "요거",
        "너무",
        "좋고",
        "품목별",
        "간단하게",
        "한번",
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
        "사는",
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
        "대강",
        "내야",
        "아니면",
        "말",
        "말을",
        "말은",
        "말이",
        "말이죠",
        "원래",
        "오긴",
        "제대",
        "어렵다고",
        "방금",
        "주십시오",
        "동의합니다",
        "고마워",
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
    }
)
ACTION_ONLY_FALLBACK_NOISE_TERMS = FRAME_OBJECT_NOISE_TERMS | frozenset(
    {
        "가까운",
        "정확히",
        "무조건",
        "나가",
        "이번에",
        "돈이",
    }
)
ACTION_OBJECT_AMBIGUOUS_TERMS = frozenset({"예약", "결제", "연락", "인증"})
ACTION_TERM_SUPPORT_ALIASES = {
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
LABEL_REVIEW_NOISE_TERMS = ACTION_ONLY_FALLBACK_NOISE_TERMS | frozenset(
    {
        "가요",
        "알게되어서",
        "드렸는데",
        "중후한데",
        "까먹어서",
        "있잖아",
        "있잖아요",
        "품목별",
        "간단하게",
        "한번",
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
        "에게",
        "보낼",
        "봐야",
        "바꾸면",
        "떨어지",
        "그래갖고",
        "해오라",
        "던데",
        "싶었던",
        "곳이라서",
        "이라서",
        "라서",
        "하려면",
        "궁금해",
        "좋겠네요",
        "유효한",
        "빠른",
        "바로",
        "방법",
        "자세히",
        "설명",
        "잠깐",
        "들어가서",
        "들어온",
        "걸로",
        "해놓",
        "많았는데",
        "점이",
        "생기면",
        "사게",
        "쓰다",
        "쓰다가",
        "싶었던",
        "곳이라서",
        "이렇게",
    }
)
LABEL_RAW_REVIEW_NOISE_SUFFIXES = (
    "이라서",
    "라서",
    "가서",
    "와서",
    "어서",
    "아서",
    "면서",
    "는데",
    "은데",
    "았는데",
    "었는데",
    "어야",
    "아야",
    "여야",
    "려야",
    "하려면",
    "다면",
    "다면요",
    "이신",
    "해야",
    "봐야",
    "던데",
    "게",
    "걸로",
    "갖고",
    "떨어지",
    "싶었던",
)
KOREAN_DISCOURSE_LABEL_NOISE_TERMS = frozenset(
    {
        "곳인",
        "마지막",
        "정말",
        "부탁드려",
        "있다면",
        "것들",
        "내용들",
        "구체적",
        "의논되지",
        "찍혀",
        "없죠",
        "말씀",
        "말씀이신",
        "말씀드린",
        "건데",
        "안에",
        "걸린",
        "거를",
        "했던",
        "원을",
        "그쪽",
        "내용이나",
        "상담받고",
        "가요",
        "해당",
        "직접",
        "뽑아야",
        "왜그런지",
        "없더",
        "옛날",
        "보내서",
        "너었으",
        "그부분",
        "그라면",
        "매달",
        "초에",
        "넣고",
        "나서",
        "나옵",
        "있어야",
        "며칠",
        "기다려야",
        "할려",
        "다운시킬",
        "불러드려야",
        "걸리나",
        "빠르다",
        "문자와서",
        "뭐죠",
        "찾았으",
        "들어가야",
        "중간",
        "나왔",
        "같아",
        "있다면",
        "거는",
        "되는",
        "되네",
        "없고",
        "조금",
        "비싼",
        "비싸",
        "비싸서",
        "싼",
        "쓰면",
        "해요",
        "거겠네",
    }
)
LABEL_REVIEW_NOISE_TERMS = LABEL_REVIEW_NOISE_TERMS | KOREAN_DISCOURSE_LABEL_NOISE_TERMS
FRAME_OBJECT_NOISE_TERMS = FRAME_OBJECT_NOISE_TERMS | KOREAN_DISCOURSE_LABEL_NOISE_TERMS
FLOW_EVENT_LABELS = {
    "확인질문": "요청확인",
    "추가정보요청": "정보수집",
    "정책안내": "기준확인",
    "불만표현": "문제확인",
    "예외처리": "예외검토",
    "해결": "결과안내",
    "이관": "상담원이관",
}
_LABEL_STOPWORDS = frozenset(
    {
        "고객",
        "고객님",
        "상담",
        "상담한",
        "상담하신",
        "상담하",
        "상담사",
        "문의",
        "문의드",
        "문의드립니다",
        "문의드릴",
        "문의드리",
        "문의하나드립니다",
        "문의사항",
        "확인",
        "합니다",
        "있습니다",
        "그리고",
        "혹시",
        "해주세요",
        "가능",
        "가능한가요",
        "가능한지",
        "가능할까요",
        "되나요",
        "되나",
        "될까요",
        "처리",
        "문의해",
        "그럼",
        "확인해",
        "확인해보고",
        "보겠습니다",
        "확인해보겠습니다",
        "저희",
        "저희가",
        "그거",
        "그것",
        "저거",
        "거예",
        "거죠",
        "이거",
        "이거죠",
        "있는",
        "있나",
        "없나",
        "있으면",
        "되는데",
        "되죠",
        "없어",
        "좋은",
        "좋네",
        "좋겠습니다",
        "남아",
        "해서",
        "아이",
        "오늘",
        "중에",
        "여부",
        "하나",
        "다른",
        "바로",
        "볼게",
        "연락드릴게",
        "연락드릴",
        "드릴게",
        "드렸어",
        "해놓게",
        "전화",
        "전화로",
        "통화",
        "일부터",
        "일까지",
        "언제든지",
        "주세요",
        "싶은데",
        "싶어",
        "정보",
        "정보들",
        "품목별",
        "간단하게",
        "한번",
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
        "에게",
        "보낼",
        "봐야",
        "바꾸면",
        "떨어지",
        "그래갖고",
        "해오라",
        "던데",
        "싶었던",
        "곳이라서",
        "이라서",
        "라서",
        "하려면",
        "곳이",
        "좋을까",
        "제가",
        "저는",
        "지금",
        "주세",
        "그러면",
        "아마",
        "그래",
        "그니깐",
        "그니까",
        "그냥",
        "같은",
        "알겠습니다",
        "알았습니다",
        "알겠어",
        "그런데",
        "근데",
        "하고",
        "보내고",
        "보내야",
        "보내드릴게",
        "보내드릴게요",
        "가고",
        "외에",
        "그렇군",
        "그렇군요",
        "그렇구나",
        "그렇죠",
        "그런",
        "그러",
        "이제",
        "어떤",
        "무슨",
        "어떻게",
        "궁금한",
        "궁금",
        "궁금해",
        "좋겠네요",
        "유효한",
        "빠른",
        "바로",
        "방법",
        "잠깐",
        "들어가서",
        "들어온",
        "걸로",
        "해놓",
        "많았는데",
        "점이",
        "생기면",
        "사게",
        "쓰다",
        "쓰다가",
        "싶었던",
        "곳이라서",
        "질문",
        "생기면",
        "생기",
        "여쭤보려고",
        "여쭤보겠습니다",
        "여쭤보면",
        "여쭤",
        "보려고",
        "다시",
        "많이",
        "되는",
        "하는데",
        "있어서",
        "있으시면",
        "있습니다",
        "있어",
        "아니",
        "아니라",
        "이게",
        "이렇게",
        "내가",
        "가지고",
        "해가지고",
        "전화해가지고",
        "필요한",
        "필요",
        "정리해서",
        "으로",
        "로",
        "메일",
        "메일로",
        "이메일",
        "대해",
        "어제",
        "여기서",
        "월",
        "월에",
        "이번",
        "진행",
        "진행하려면",
        "진행하면",
        "진행하고",
        "있어서",
        "있으면요",
        "있는지",
        "적용되지",
        "포함되지",
        "않으면",
        "않는",
        "생각",
        "생각하고",
        "후에",
        "다양하네",
        "차이",
        "어느",
        "사이",
        "한지",
        "주실",
        "정도",
        "얼마",
        "얼마죠",
        "얼마입니까",
        "너무",
        "좋고",
        "입니까",
        "뭐예",
        "뭐예요",
        "뭐에요",
        "뭔지",
        "맞아",
        "맞아요",
        "갑자기",
        "알아봐주세",
        "알아봐주세요",
        "감사",
        "갑사합니다",
        "고맙습니다",
        "건강",
        "고생",
        "부탁드릴게",
        "부탁드릴게요",
        "부탁드립니다",
        "부탁드려요",
        "부탁",
        "뭐야",
        "뭐니",
        "보통",
        "바라겠습니다",
        "바라겠",
        "괜찮아",
        "괜찮은",
        "괜찮",
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
        "없습니다",
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
        "맞습니다",
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
        "주말",
        "잠시만",
        "드리겠습니다",
        "보내십시오",
        "계속",
        "그래서",
        "그렇게",
        "아직",
        "미정",
        "상태",
        "이겠으나",
        "수와",
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
        "추가로",
        "해야",
        "기다릴게",
        "기다릴게요",
        "기다리",
        "받을",
        "받아",
        "받는",
        "받은",
        "있다고",
        "왔었는데",
        "바꾸긴",
        "잘된",
        "잘됨",
        "건가",
        "거기",
        "것도",
        "분",
        "분은",
        "분이",
        "분을",
        "분한테",
        "있죠",
        "드리면",
        "때문에",
        "하면",
        "했어",
        "됐는데",
        "거든",
        "거든요",
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
        "안낸",
        "없는데",
        "제를",
        "보니",
        "당연히",
        "얘기",
        "나오더라고",
        "모르고",
        "있던",
        "부분이어서",
        "부분",
        "것",
        "것만",
        "값",
        "값이",
        "돼요",
        "제일",
        "가서",
        "들어왔어",
        "말고",
        "올려",
        "하여튼",
        "항상",
        "똑같",
        "어쩌고",
        "얼마짜리",
        "따로",
        "나와",
        "나온다니까",
        "곧바",
        "곧바로",
        "미리",
        "있을까",
        "있을까요",
        "있는데",
        "요거",
        "이런",
        "저런",
        "사는",
        "작년",
        "지난해",
        "올해",
        "엄마",
        "일단",
        "에는",
        "부터",
        "만약에",
        "했는데",
        "그러니까",
        "하려구",
        "하려구요",
        "하니까",
        "확인하니까",
        "되고",
        "받아서",
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
        "대강",
        "내야",
        "아니면",
        "말",
        "말을",
        "말은",
        "말이",
        "원래",
        "오긴",
        "제대",
        "어렵다고",
        "방금",
        "주십시오",
        "동의합니다",
        "고마워",
        "들어가",
        "들어가고",
        "들어간",
        "했을",
        "거잖아",
        "저쩌고",
        "없이",
        "까먹어서",
        "나가",
        "나가는",
        "바꾸었",
        "바꾸었는지",
        "수가",
        "얼마나",
        "해도",
        "달에",
        "월요일",
        "화요일",
        "수요일",
        "목요일",
        "금요일",
        "토요일",
        "일요일",
        "phone_number",
        "email_address",
        "date",
        "time",
        "name",
        "number",
        "birth",
        "birth_number",
        "charge",
        "mobile",
        "mobile_number",
        "personal_name",
        "phone",
        "email",
        "address",
        "account",
        "amount",
        "card_number",
        "order_id",
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
        "문의하나",
        "들었",
        "되었어",
        "연락드리면",
        "그전",
        "줄도",
        "낼라",
        "안내",
        "쉬운",
    }
)
_LABEL_STOPWORDS = _LABEL_STOPWORDS | KOREAN_DISCOURSE_LABEL_NOISE_TERMS
_LABEL_SUFFIXES = (
    "일부터",
    "일까지",
    "부터",
    "까지",
    "하려면",
    "이라서",
    "라서",
    "가서",
    "와서",
    "어서",
    "아서",
    "면서",
    "는데",
    "은데",
    "았는데",
    "었는데",
    "어야",
    "아야",
    "여야",
    "려야",
    "다면",
    "다면요",
    "이신",
    "드린",
    "건데",
    "되고",
    "하면",
    "싶은데",
    "싶어서",
    "싶어",
    "하려구요",
    "하려구",
    "하니까",
    "니까",
    "돼서",
    "받아서",
    "입니다",
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
    "었는지",
    "는지",
    "해야",
    "게",
    "걸로",
    "됐어",
    "했어",
    "볼게",
    "해서",
    "되죠",
    "된",
    "하고",
    "하",
    "해",
    "에는",
    "에",
    "으로",
    "로",
    "와",
    "과",
    "에서",
    "에게",
    "의",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "도",
    "만",
    "할",
    "거든",
    "거든요",
    "됐는데",
    "인데",
    "라고",
    "입니까",
    "려고",
    "보려고",
    "요",
)


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="flow_splitting")
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    split_strategy = _resolve_flow_split_strategy()
    min_split_size = _resolve_min_split_size()
    clusters_payload = _read_json(
        _upstream_stage_dir("intent_discovery", runtime_config, stage_context) / CLUSTERS_ARTIFACT
    )
    preprocessed_index = _read_preprocessed_index(runtime_config, stage_context)

    clusters = clusters_payload.get("clusters")
    if not isinstance(clusters, list):
        raise PipelineStageError("intent_discovery clusters.json must contain a clusters list.")
    member_index_lookup = _member_index_lookup(runtime_config, stage_context, clusters_payload)
    compacted_clusters = _merge_duplicate_intent_labels(clusters, preprocessed_index)
    quality_filtered_clusters, low_quality_filter_report = _drop_low_quality_clusters(
        compacted_clusters,
        preprocessed_index,
    )
    novel_review_clusters, novel_review_report = _promote_novel_candidates(
        clusters_payload,
        preprocessed_index,
        existing_member_ids=_cluster_member_id_set(quality_filtered_clusters),
        min_size=NOVEL_REVIEW_CANDIDATE_MIN_SIZE,
    )
    candidate_clusters = quality_filtered_clusters + novel_review_clusters

    split_clusters: list[dict[str, Any]] = []
    entrypoints: list[dict[str, Any]] = []
    split_count = 0
    next_cluster_id = 0
    for cluster in candidate_clusters:
        if not isinstance(cluster, dict):
            continue
        groups = _flow_groups(
            cast(dict[str, Any], cluster),
            preprocessed_index,
            strategy=split_strategy,
            min_split_size=min_split_size,
        )
        if len(groups) <= 1:
            group_key = next(iter(groups), "single_flow")
            split_reason = "mixed_flow" if group_key == "mixed_flow" else group_key
            copied = dict(cluster)
            copied["workflow_entrypoint_id"] = f"entrypoint-{next_cluster_id}"
            copied["source_cluster_id"] = cluster.get("cluster_id")
            copied["cluster_id"] = next_cluster_id
            copied["flow_split_key"] = split_reason
            copied["workflow_signal"] = _merged_workflow_signal(
                _string_list(copied.get("member_conv_ids")),
                preprocessed_index,
                cluster.get("workflow_signal"),
            )
            copied["member_indices"] = _member_indices_for_ids(
                _string_list(copied.get("member_conv_ids")),
                member_index_lookup,
                fallback=_int_list(copied.get("member_indices")),
            )
            copied["cluster_size"] = len(_string_list(copied.get("member_conv_ids")))
            _apply_regenerated_label_metadata(
                copied,
                cluster,
                _string_list(copied.get("member_conv_ids")),
                preprocessed_index,
                split_reason,
            )
            split_clusters.append(copied)
            entrypoints.append(_entrypoint(copied, split_reason=split_reason))
            next_cluster_id += 1
            continue
        split_count += len(groups) - 1
        for key, member_ids in groups.items():
            copied = dict(cluster)
            copied["workflow_entrypoint_id"] = f"entrypoint-{next_cluster_id}"
            copied["source_cluster_id"] = cluster.get("cluster_id")
            copied["cluster_id"] = next_cluster_id
            copied["member_conv_ids"] = member_ids
            copied["cluster_size"] = len(member_ids)
            split_exemplars = [conv_id for conv_id in cluster.get("exemplar_conv_ids", []) if conv_id in member_ids][:5]
            copied["exemplar_conv_ids"] = split_exemplars or member_ids[:5]
            copied["flow_split_key"] = key
            copied["workflow_signal"] = _merged_workflow_signal(
                member_ids,
                preprocessed_index,
                cluster.get("workflow_signal"),
            )
            copied["member_indices"] = _member_indices_for_ids(member_ids, member_index_lookup)
            _apply_regenerated_label_metadata(copied, cluster, member_ids, preprocessed_index, key)
            split_clusters.append(copied)
            entrypoints.append(_entrypoint(copied, split_reason=key))
            next_cluster_id += 1

    _resolve_duplicate_generated_labels(split_clusters, preprocessed_index)
    _enforce_review_only_labels(split_clusters)
    entrypoint_semantic_report = _apply_entrypoint_semantic_metadata(split_clusters, runtime_config, stage_context)
    output_payload = dict(clusters_payload)
    output_payload["schema_version"] = "2.0"
    output_payload["stage"] = "flow_splitting"
    _apply_workflow_review_metadata(
        split_clusters,
        entrypoints,
        preprocessed_index,
        total_member_count=_total_member_count(candidate_clusters),
        min_split_size=min_split_size,
    )
    output_payload["clusters"] = split_clusters
    output_payload["workflow_entrypoints_path"] = WORKFLOW_ENTRYPOINTS_ARTIFACT
    confidence_report = _workflow_confidence_report(split_clusters)
    report = {
        "schemaVersion": "flow-splitting.v2",
        "inputClusterCount": len(clusters),
        "compactedClusterCount": len(compacted_clusters),
        **low_quality_filter_report,
        **novel_review_report,
        "outputEntryPointCount": len(entrypoints),
        "splitCount": split_count,
        "minSplitSize": min_split_size,
        "splitStrategy": split_strategy,
        "mixedFlowCount": _split_reason_count(entrypoints, "mixed_flow"),
        "mixedResidualCount": _split_reason_count(entrypoints, "mixed_residual"),
        "sequenceSplitCount": sum(
            1 for entrypoint in entrypoints if _split_reason_has_sequence(str(entrypoint.get("splitReason", "")))
        ),
        "actionObjectSplitCount": sum(
            1 for entrypoint in entrypoints if _split_reason_has_action_object(str(entrypoint.get("splitReason", "")))
        ),
        "actionSplitCount": sum(
            1 for entrypoint in entrypoints if _split_reason_has_action(str(entrypoint.get("splitReason", "")))
        ),
        "workflowSeparability": _workflow_separability(entrypoints),
        **entrypoint_semantic_report,
        **confidence_report,
    }
    output_payload["flow_split_metrics"] = report
    clusters_path = output_dir / CLUSTERS_ARTIFACT
    entrypoints_path = output_dir / WORKFLOW_ENTRYPOINTS_ARTIFACT
    report_path = output_dir / FLOW_SPLIT_REPORT_ARTIFACT
    clusters_path.write_text(json.dumps(output_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    entrypoints_path.write_text(
        json.dumps({"workflowEntryPoints": entrypoints}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    manifest_path = write_stage_manifest(
        stage_context,
        runtime_config,
        {
            "upstream_manifest_path": upstream_manifest_path,
            "artifact_path": clusters_path.name,
            "workflowEntryPointsPath": entrypoints_path.name,
            "reportPath": report_path.name,
            "recordCount": len(entrypoints),
            "metrics": report,
        },
    )
    return {"artifact_manifest_path": str(manifest_path.resolve())}


def _resolve_flow_split_strategy() -> str:
    strategy = os.getenv("PIPELINE_FLOW_SPLIT_STRATEGY", "expanded").strip().lower()
    if strategy not in FLOW_SPLIT_STRATEGIES:
        return "conservative"
    return strategy


def _resolve_min_split_size() -> int:
    value = os.getenv("PIPELINE_FLOW_MIN_SPLIT_SIZE", "").strip()
    if not value:
        return MIN_SPLIT_SIZE
    try:
        parsed = int(value)
    except ValueError:
        return MIN_SPLIT_SIZE
    return parsed if parsed > 0 else MIN_SPLIT_SIZE


def _resolve_expanded_min_split_size(min_split_size: int) -> int:
    value = os.getenv("PIPELINE_FLOW_EXPANDED_MIN_SPLIT_SIZE", "").strip()
    if value:
        try:
            parsed = int(value)
        except ValueError:
            parsed = EXPANDED_MIN_SPLIT_SIZE
    else:
        parsed = EXPANDED_MIN_SPLIT_SIZE
    return max(2, min(parsed, min_split_size))


def _member_index_lookup(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
    clusters_payload: dict[str, Any],
) -> dict[str, int]:
    lookup = _representation_member_index_lookup(runtime_config, stage_context)
    if lookup:
        return lookup
    for cluster in clusters_payload.get("clusters", []):
        if not isinstance(cluster, dict):
            continue
        member_ids = _string_list(cluster.get("member_conv_ids"))
        member_indices = _int_list(cluster.get("member_indices"))
        if len(member_ids) != len(member_indices):
            continue
        for member_id, member_index in zip(member_ids, member_indices):
            lookup.setdefault(member_id, member_index)
    return lookup


def _representation_member_index_lookup(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> dict[str, int]:
    index_path = _upstream_stage_dir("representation", runtime_config, stage_context) / "embedding_index.json"
    if not index_path.exists():
        return {}
    try:
        payload = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, list):
        return {}
    output: dict[str, int] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        conversation_id = item.get("conversationId")
        row_index = item.get("rowIndex")
        embedding_success = item.get("embeddingSuccess")
        if isinstance(conversation_id, str) and isinstance(row_index, int) and embedding_success is True:
            output[conversation_id] = row_index
    return output


def _member_indices_for_ids(
    member_ids: list[str],
    member_index_lookup: dict[str, int],
    fallback: list[int] | None = None,
) -> list[int]:
    indices = [member_index_lookup[member_id] for member_id in member_ids if member_id in member_index_lookup]
    if indices:
        return indices
    return list(fallback or [])


def _merge_duplicate_intent_labels(
    clusters: list[object],
    preprocessed_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for cluster in clusters:
        if not isinstance(cluster, dict):
            continue
        cluster_key = _cluster_compaction_key(cluster)
        if cluster_key not in merged:
            copied = dict(cluster)
            source_cluster_id = copied.get("cluster_id")
            copied["source_cluster_ids"] = [source_cluster_id] if source_cluster_id is not None else []
            merged[cluster_key] = copied
            continue
        target = merged[cluster_key]
        _extend_unique(target, "member_conv_ids", _string_list(cluster.get("member_conv_ids")))
        _extend_unique_int(target, "member_indices", _int_list(cluster.get("member_indices")))
        _extend_unique(target, "exemplar_conv_ids", _string_list(cluster.get("exemplar_conv_ids")), limit=5)
        _extend_unique(target, "keywords", _string_list(cluster.get("keywords")), limit=12)
        source_cluster_id = cluster.get("cluster_id")
        if source_cluster_id is not None:
            sources = target.setdefault("source_cluster_ids", [])
            if isinstance(sources, list) and source_cluster_id not in sources:
                sources.append(source_cluster_id)
        target["cluster_size"] = len(_string_list(target.get("member_conv_ids")))
        target["workflow_signal"] = _merged_workflow_signal(
            _string_list(target.get("member_conv_ids")),
            preprocessed_index,
            target.get("workflow_signal"),
        )
        target["quality"] = _merge_quality(target.get("quality"), cluster.get("quality"))
    return list(merged.values())


def _drop_low_quality_clusters(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int | float]]:
    kept: list[dict[str, Any]] = []
    dropped_count = 0
    dropped_members = 0
    for cluster in clusters:
        member_ids = _string_list(cluster.get("member_conv_ids"))
        low_quality_ratio = _low_quality_member_ratio(member_ids, preprocessed_index)
        if member_ids and low_quality_ratio >= LOW_QUALITY_CLUSTER_DROP_RATIO:
            dropped_count += 1
            dropped_members += len(member_ids)
            continue
        copied = dict(cluster)
        copied["low_quality_member_ratio"] = low_quality_ratio
        kept.append(copied)
    return kept, {
        "qualityFilteredClusterCount": len(kept),
        "droppedLowQualityClusterCount": dropped_count,
        "droppedLowQualityMemberCount": dropped_members,
        "lowQualityClusterDropRatio": LOW_QUALITY_CLUSTER_DROP_RATIO,
    }


def _promote_novel_candidates(
    clusters_payload: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    existing_member_ids: set[str],
    min_size: int,
) -> tuple[list[dict[str, Any]], dict[str, int | float]]:
    raw_candidates = clusters_payload.get("novel_candidates")
    raw_outlier_count = _int_from_mapping(clusters_payload.get("stats"), "outlier_count")
    input_count = _int_from_mapping(clusters_payload.get("stats"), "input_count")
    if not isinstance(raw_candidates, list):
        return [], _novel_candidate_report(0, 0, 0, raw_outlier_count, input_count)

    promoted: list[dict[str, Any]] = []
    skipped_count = 0
    represented_members: set[str] = set()
    for candidate in raw_candidates:
        if not isinstance(candidate, dict):
            skipped_count += 1
            continue
        member_ids = [
            member_id
            for member_id in _string_list(candidate.get("member_conv_ids"))
            if member_id in preprocessed_index
            and member_id not in existing_member_ids
            and member_id not in represented_members
        ]
        if len(member_ids) < min_size:
            skipped_count += 1
            continue
        promoted.append(_novel_candidate_cluster(candidate, member_ids, preprocessed_index))
        represented_members.update(member_ids)

    report = _novel_candidate_report(
        len(raw_candidates),
        len(promoted),
        len(represented_members),
        raw_outlier_count,
        input_count,
    )
    report["skippedNovelCandidateCount"] = skipped_count
    report["novelCandidateMinSize"] = min_size
    return promoted, report


def _novel_candidate_cluster(
    candidate: dict[str, Any],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    label = _stabilized_novel_label(candidate, _regenerated_split_label(member_ids, preprocessed_index))
    suggested_name = str(label.get("name") or candidate.get("suggested_name") or "미분류 문의").strip()
    label_score = min(_float_value(label.get("score"), default=0.0), 0.64)
    evidence_coverage = _float_value(label.get("evidenceCoverage"), default=0.0)
    member_evidence_coverage = _float_value(label.get("memberEvidenceCoverage"), default=evidence_coverage)
    workflow_consistency = _clamp(
        (0.55 * _dominant_sequence_share(member_ids, preprocessed_index))
        + (0.45 * _dominant_signal_share(member_ids, preprocessed_index))
    )
    return {
        "cluster_id": -1,
        "member_conv_ids": member_ids,
        "exemplar_conv_ids": member_ids[:5],
        "keywords": _split_label_terms(member_ids, preprocessed_index)[:8],
        "suggested_name": suggested_name,
        "suggested_description": f"{suggested_name} review 후보",
        "workflow_signal": _merged_workflow_signal(member_ids, preprocessed_index, {}),
        "quality": {
            "interpretability_score": max(0.35, min(0.62, label_score or evidence_coverage)),
            "workflow_consistency_score": workflow_consistency,
            "branching_explainability_score": min(0.60, workflow_consistency),
        },
        "review_hint": "novel_outlier_candidate",
        "label_source": "novel_outlier_candidate",
        "label_score": label_score,
        "label_evidence_coverage": evidence_coverage,
        "label_member_evidence_coverage": member_evidence_coverage,
        "label_object_coverage": label.get("objectCoverage"),
        "label_action_coverage": label.get("actionCoverage"),
        "label_object_action_joint_coverage": label.get("objectActionJointCoverage"),
        "label_action_object_validity": label.get("actionObjectValidity"),
        "label_candidates": label.get("candidates", []),
        "action_object_frame": label.get("actionObjectFrame", {}),
        "label_validation_status": "needs_review",
        "source_type": candidate.get("source_type"),
        "source_candidate_key": candidate.get("candidate_key"),
        "candidate_size": candidate.get("candidate_size"),
        "is_novel_outlier_candidate": True,
    }


def _stabilized_novel_label(source: dict[str, Any], label: dict[str, Any]) -> dict[str, Any]:
    if source.get("is_novel_outlier_candidate") is not True and not str(source.get("source_type") or "").startswith(
        "outlier_"
    ):
        return label
    evidence_coverage = _float_value(label.get("evidenceCoverage"), default=0.0)
    label_score = _float_value(label.get("score"), default=0.0)
    label_name = str(label.get("name") or "")
    if evidence_coverage >= 0.25 and label_score >= 0.58 and _weak_label_penalty(label_name) <= 0.10:
        return label
    fallback_name = _novel_fallback_name(source)
    score = min(label_score, 0.45)
    return {
        **label,
        "name": fallback_name,
        "score": score,
        "candidates": [
            {
                "name": fallback_name,
                "score": score,
                "source": "novel_candidate_fallback",
                "evidenceCoverage": evidence_coverage,
                "actionObjectValidity": _float_value(label.get("actionObjectValidity"), default=0.35),
            }
        ],
    }


def _novel_fallback_name(source: dict[str, Any]) -> str:
    source_type = str(source.get("source_type") or "")
    suggested_name = str(source.get("suggested_name") or "").strip()
    if source_type == "outlier_flow":
        return _novel_flow_fallback_name(source)
    if source_type == "outlier_status":
        return REVIEW_PLACEHOLDER_LABEL
    if suggested_name and not suggested_name.casefold().startswith("unknown"):
        return suggested_name
    return REVIEW_PLACEHOLDER_LABEL


def _novel_flow_fallback_name(source: dict[str, Any]) -> str:
    return REVIEW_PLACEHOLDER_LABEL


def _novel_candidate_report(
    input_count: int,
    promoted_count: int,
    represented_member_count: int,
    raw_outlier_count: int,
    total_input_count: int,
) -> dict[str, int | float]:
    unrepresented_count = max(0, raw_outlier_count - represented_member_count)
    return {
        "novelCandidateInputCount": input_count,
        "promotedNovelCandidateCount": promoted_count,
        "promotedNovelMemberCount": represented_member_count,
        "rawOutlierMemberCount": raw_outlier_count,
        "unrepresentedOutlierMemberCount": unrepresented_count,
        "representedOutlierCoverage": (represented_member_count / raw_outlier_count if raw_outlier_count > 0 else 0.0),
        "unrepresentedOutlierRate": unrepresented_count / total_input_count if total_input_count > 0 else 0.0,
    }


def _cluster_member_id_set(clusters: list[dict[str, Any]]) -> set[str]:
    output: set[str] = set()
    for cluster in clusters:
        output.update(_string_list(cluster.get("member_conv_ids")))
    return output


def _int_from_mapping(value: object, key: str) -> int:
    if not isinstance(value, dict):
        return 0
    raw_value = value.get(key)
    if isinstance(raw_value, bool):
        return 0
    if isinstance(raw_value, int):
        return raw_value
    if isinstance(raw_value, float):
        return int(raw_value)
    return 0


def _low_quality_member_ratio(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    if not member_ids:
        return 0.0
    low_quality_count = 0
    for conv_id in member_ids:
        row = preprocessed_index.get(conv_id)
        if not isinstance(row, dict):
            continue
        quality_score = row.get("quality_score")
        quality_tier = str(row.get("quality_tier") or "").upper()
        if (
            row.get("filtered") is True
            or quality_tier in {"C", "D"}
            or (isinstance(quality_score, (int, float)) and not isinstance(quality_score, bool) and quality_score < 0.8)
        ):
            low_quality_count += 1
    return low_quality_count / len(member_ids)


def _cluster_compaction_key(cluster: dict[str, Any]) -> str:
    root_domain = str(cluster.get("root_domain") or "")
    name = str(cluster.get("canonical_intent") or cluster.get("suggested_name") or "").strip().casefold()
    return f"{root_domain}:{name}" if name else f"cluster:{cluster.get('cluster_id')}"


def _extend_unique(
    target: dict[str, Any],
    key: str,
    values: list[str],
    limit: int | None = None,
) -> None:
    items = target.setdefault(key, [])
    if not isinstance(items, list):
        items = []
        target[key] = items
    for value in values:
        if value not in items:
            items.append(value)
        if limit is not None and len(items) >= limit:
            break


def _extend_unique_int(
    target: dict[str, Any],
    key: str,
    values: list[int],
) -> None:
    items = target.setdefault(key, [])
    if not isinstance(items, list):
        items = []
        target[key] = items
    for value in values:
        if value not in items:
            items.append(value)


def _merge_quality(left: object, right: object) -> dict[str, float]:
    if not isinstance(left, dict):
        left = {}
    if not isinstance(right, dict):
        right = {}
    output: dict[str, float] = {}
    for key in ("interpretability_score", "workflow_consistency_score", "branching_explainability_score"):
        values = [
            float(value)
            for value in (left.get(key), right.get(key))
            if isinstance(value, (int, float)) and not isinstance(value, bool)
        ]
        if values:
            output[key] = sum(values) / len(values)
    return output


def _flow_groups(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    strategy: str = "conservative",
    min_split_size: int = MIN_SPLIT_SIZE,
) -> dict[str, list[str]]:
    member_ids = _string_list(cluster.get("member_conv_ids"))
    if strategy == "conservative":
        return {"single_flow": member_ids}

    grouped: dict[str, list[str]] = defaultdict(list)
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id, {})
        ended_status = str(conversation.get("ended_status") or "unknown")
        signal = conversation.get("workflow_signal", cluster.get("workflow_signal"))
        signal_key = _signal_key(signal if isinstance(signal, dict) else {})
        grouped[_flow_group_key(ended_status, signal_key)].append(conv_id)
    if len(grouped) <= 1:
        base_groups = dict(grouped)
        if strategy == "expanded":
            expanded_groups = _expanded_action_object_groups(base_groups, preprocessed_index, min_split_size)
            expanded_groups = _expanded_action_groups(expanded_groups, preprocessed_index, min_split_size)
            return _expanded_sequence_groups(expanded_groups, preprocessed_index, min_split_size)
        for fallback_groups in (
            _action_object_flow_groups(member_ids, preprocessed_index, min_split_size),
            _action_flow_groups(member_ids, preprocessed_index, min_split_size),
            _sequence_flow_groups(member_ids, preprocessed_index, min_split_size),
        ):
            if len(fallback_groups) > 1:
                return fallback_groups
        return base_groups
    groups = _major_groups_with_residual(grouped, min_split_size)
    if strategy == "expanded":
        base_groups = groups if groups else {"mixed_flow": member_ids}
        expanded_groups = _expanded_action_object_groups(base_groups, preprocessed_index, min_split_size)
        expanded_groups = _expanded_action_groups(expanded_groups, preprocessed_index, min_split_size)
        expanded_groups = _expanded_sequence_groups(expanded_groups, preprocessed_index, min_split_size)
        if len(expanded_groups) > 1:
            return expanded_groups

    if len(groups) > 1:
        return groups

    for fallback_groups in (
        _action_object_flow_groups(member_ids, preprocessed_index, min_split_size),
        _action_flow_groups(member_ids, preprocessed_index, min_split_size),
        _sequence_flow_groups(member_ids, preprocessed_index, min_split_size),
    ):
        if len(fallback_groups) > 1:
            return fallback_groups

    if groups:
        return groups
    return {"mixed_flow": member_ids}


def _expanded_action_object_groups(
    base_groups: dict[str, list[str]],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    expanded: dict[str, list[str]] = {}
    expanded_min_size = _resolve_expanded_min_split_size(min_split_size)
    for base_key, member_ids in base_groups.items():
        if len(member_ids) < expanded_min_size * 2:
            expanded[base_key] = member_ids
            continue
        action_object_groups = _action_object_flow_groups(member_ids, preprocessed_index, expanded_min_size)
        if len(action_object_groups) <= 1:
            expanded[base_key] = member_ids
            continue
        for action_key, action_member_ids in action_object_groups.items():
            expanded[f"{base_key}{COMPOUND_SPLIT_SEPARATOR}{action_key}"] = action_member_ids
    return expanded


def _expanded_action_groups(
    base_groups: dict[str, list[str]],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    expanded: dict[str, list[str]] = {}
    expanded_min_size = _resolve_expanded_min_split_size(min_split_size)
    for base_key, member_ids in base_groups.items():
        if len(member_ids) < expanded_min_size * 2:
            expanded[base_key] = member_ids
            continue
        action_groups = _action_flow_groups(member_ids, preprocessed_index, expanded_min_size)
        if len(action_groups) <= 1:
            expanded[base_key] = member_ids
            continue
        for action_key, action_member_ids in action_groups.items():
            expanded[f"{base_key}{COMPOUND_SPLIT_SEPARATOR}{action_key}"] = action_member_ids
    return expanded


def _expanded_sequence_groups(
    base_groups: dict[str, list[str]],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    expanded: dict[str, list[str]] = {}
    expanded_min_size = _resolve_expanded_min_split_size(min_split_size)
    for base_key, member_ids in base_groups.items():
        if len(member_ids) < expanded_min_size * 2:
            expanded[base_key] = member_ids
            continue
        sequence_groups = _sequence_flow_groups(member_ids, preprocessed_index, expanded_min_size)
        if len(sequence_groups) <= 1:
            expanded[base_key] = member_ids
            continue
        for sequence_key, sequence_member_ids in sequence_groups.items():
            expanded[f"{base_key}{COMPOUND_SPLIT_SEPARATOR}{sequence_key}"] = sequence_member_ids
    return expanded


def _action_object_flow_groups(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    unknown_members: list[str] = []
    for conv_id in member_ids:
        key = _action_object_sequence_key(preprocessed_index.get(conv_id))
        if not key:
            unknown_members.append(conv_id)
            continue
        grouped[key].append(conv_id)
    groups = _major_groups_with_residual(grouped, min_split_size)
    if len(groups) <= 1:
        return {}
    if unknown_members:
        groups.setdefault("mixed_residual", []).extend(unknown_members)
    return groups


def _action_object_sequence_key(conversation: object) -> str:
    if not isinstance(conversation, dict):
        return ""
    frame = conversation.get("action_object_frame")
    if not isinstance(frame, dict) or _frame_confidence(frame) < 0.65:
        return ""
    object_term = _frame_object_value(frame)
    action = _frame_value(frame, "action")
    if not object_term or not action:
        return ""
    if not _is_split_label_term(object_term) or not _is_action_label_term(action):
        return ""
    return f"{ACTION_OBJECT_SPLIT_PREFIX}{object_term}>{action}"


def _action_flow_groups(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    unknown_members: list[str] = []
    for conv_id in member_ids:
        key = _action_sequence_key(preprocessed_index.get(conv_id))
        if not key:
            unknown_members.append(conv_id)
            continue
        grouped[key].append(conv_id)
    groups = _major_groups_with_residual(grouped, min_split_size)
    if len(groups) <= 1:
        return {}
    if unknown_members:
        groups.setdefault("mixed_residual", []).extend(unknown_members)
    return groups


def _action_sequence_key(conversation: object) -> str:
    if not isinstance(conversation, dict):
        return ""
    frame = conversation.get("action_object_frame")
    if not isinstance(frame, dict) or _frame_confidence(frame) < 0.55:
        return ""
    action = _frame_value(frame, "action")
    if not _is_action_label_term(action):
        return ""
    return f"{ACTION_SPLIT_PREFIX}{action}"


def _major_groups_with_residual(
    grouped: dict[str, list[str]],
    min_split_size: int,
) -> dict[str, list[str]]:
    major_groups = {key: value for key, value in grouped.items() if len(value) >= min_split_size}
    if not major_groups:
        return {}
    residual = [conv_id for key, values in grouped.items() if key not in major_groups for conv_id in values]
    if residual:
        major_groups["mixed_residual"] = residual
    return major_groups


def _sequence_flow_groups(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    min_split_size: int,
) -> dict[str, list[str]]:
    for max_events in (4, 3, 2):
        grouped: dict[str, list[str]] = defaultdict(list)
        for conv_id in member_ids:
            key = _event_sequence_key(preprocessed_index.get(conv_id), max_events=max_events)
            grouped[key].append(conv_id)
        if len(grouped) <= 1:
            continue
        groups = _major_groups_with_residual(grouped, min_split_size)
        if len(groups) > 1:
            return groups
    return {}


def _event_sequence_key(conversation: object, max_events: int = 3) -> str:
    if not isinstance(conversation, dict):
        return f"{SEQUENCE_SPLIT_PREFIX}unknown"
    raw_events = conversation.get("flow_events")
    if not isinstance(raw_events, list):
        return f"{SEQUENCE_SPLIT_PREFIX}unknown"
    events = _collapsed_events([str(event) for event in raw_events if isinstance(event, str)])
    if not events:
        return f"{SEQUENCE_SPLIT_PREFIX}unknown"
    return f"{SEQUENCE_SPLIT_PREFIX}{'>'.join(events[:max_events])}"


def _collapsed_events(events: list[str]) -> list[str]:
    output: list[str] = []
    for event in events:
        if event and (not output or output[-1] != event):
            output.append(event)
    return output


def _flow_group_key(ended_status: str, signal_key: str) -> str:
    if ended_status in {"resolved", "escalated"}:
        return f"{ended_status}:{signal_key}"
    return signal_key


def _merged_workflow_signal(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    fallback_signal: object,
) -> dict[str, bool]:
    keys: set[str] = set()
    if isinstance(fallback_signal, dict):
        keys.update(str(key) for key in fallback_signal)
    for conv_id in member_ids:
        signal = preprocessed_index.get(conv_id, {}).get("workflow_signal")
        if isinstance(signal, dict):
            keys.update(str(key) for key in signal)
    output: dict[str, bool] = {}
    has_member_signal = any(
        isinstance(preprocessed_index.get(conv_id, {}).get("workflow_signal"), dict) for conv_id in member_ids
    )
    for key in sorted(keys):
        fallback_value = isinstance(fallback_signal, dict) and fallback_signal.get(key) is True
        member_value = any(
            isinstance((signal := preprocessed_index.get(conv_id, {}).get("workflow_signal")), dict)
            and signal.get(key) is True
            for conv_id in member_ids
        )
        output[key] = member_value if has_member_signal else fallback_value
    return output


def _workflow_separability(entrypoints: list[dict[str, Any]]) -> float:
    if not entrypoints:
        return 0.0
    mixed_count = sum(1 for entrypoint in entrypoints if entrypoint.get("splitReason") == "mixed_flow")
    return 1.0 - (mixed_count / len(entrypoints))


def _split_reason_count(entrypoints: list[dict[str, Any]], reason: str) -> int:
    return sum(1 for entrypoint in entrypoints if entrypoint.get("splitReason") == reason)


def _signal_key(signal: dict[object, object]) -> str:
    enabled = sorted(str(key) for key, value in signal.items() if value is True)
    return "+".join(enabled) if enabled else "no_signal"


def _apply_regenerated_label_metadata(
    target: dict[str, Any],
    source_cluster: dict[str, Any],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    split_key: str,
) -> None:
    label = _review_safe_generated_label(
        _stabilized_novel_label(source_cluster, _regenerated_split_label(member_ids, preprocessed_index)),
        member_ids,
        preprocessed_index,
        split_key,
    )
    target["suggested_name"] = label["name"] or _split_name(
        str(source_cluster.get("suggested_name") or "Intent"), split_key
    )
    target["label_source"] = "flow_split_regenerated_terms"
    target["label_score"] = label["score"]
    target["label_evidence_coverage"] = label["evidenceCoverage"]
    target["label_member_evidence_coverage"] = label.get("memberEvidenceCoverage")
    target["label_object_coverage"] = label.get("objectCoverage")
    target["label_action_coverage"] = label.get("actionCoverage")
    target["label_object_action_joint_coverage"] = label.get("objectActionJointCoverage")
    target["label_action_object_validity"] = label.get("actionObjectValidity")
    target["label_candidates"] = label.get("candidates", [])
    target["action_object_frame"] = label.get("actionObjectFrame", {})
    target["label_validation_status"] = (
        "auto_acceptable"
        if len(member_ids) >= AUTO_LABEL_MIN_MEMBER_COUNT and _split_label_auto_acceptable(label)
        else "needs_review"
    )


def _split_name(base_name: str, split_key: str) -> str:
    label = _split_label(split_key)
    if label == "기본 처리":
        return base_name
    return f"{base_name} - {label}"


def _split_label(split_key: str) -> str:
    if COMPOUND_SPLIT_SEPARATOR in split_key:
        parts = [_split_label(part) for part in split_key.split(COMPOUND_SPLIT_SEPARATOR) if part]
        parts = [part for part in parts if part and part != "기본 처리"]
        return " · ".join(parts[:3]) if parts else "기본 처리"
    signal_key = split_key.split(":", 1)[1] if ":" in split_key else split_key
    if split_key == "mixed_residual":
        return "기타 처리 흐름"
    if split_key.startswith(ACTION_OBJECT_SPLIT_PREFIX):
        return _action_object_split_label(split_key)
    if split_key.startswith(ACTION_SPLIT_PREFIX):
        return _action_split_label(split_key)
    if split_key.startswith(SEQUENCE_SPLIT_PREFIX):
        return _sequence_split_label(split_key)
    labels: list[str] = []
    if "requires_user_identification" in signal_key:
        labels.append("본인확인 필요")
    if "requires_payment_check" in signal_key:
        labels.append("결제확인 필요")
    if split_key.startswith("escalated:") or "has_escalation_cases" in signal_key:
        labels.append("상담원 이관 포함")
    return " · ".join(labels) if labels else "기본 처리"


def _sequence_split_label(split_key: str) -> str:
    raw_sequence = split_key.removeprefix(SEQUENCE_SPLIT_PREFIX)
    labels = [FLOW_EVENT_LABELS.get(event, event) for event in raw_sequence.split(">") if event]
    if not labels or labels == ["unknown"]:
        return "관측 흐름 분리"
    return " · ".join(labels[:3]) + " 흐름"


def _action_object_split_label(split_key: str) -> str:
    raw = split_key.removeprefix(ACTION_OBJECT_SPLIT_PREFIX)
    if ">" not in raw:
        return "요청 대상 분리"
    object_term, action = raw.split(">", 1)
    object_term = object_term.strip()
    action = action.strip()
    if object_term and action:
        return f"{object_term} {action} 기준"
    return "요청 대상 분리"


def _action_split_label(split_key: str) -> str:
    action = split_key.removeprefix(ACTION_SPLIT_PREFIX).strip()
    return f"{action} 처리" if action else "요청 유형 분리"


def _split_reason_has_sequence(split_reason: str) -> bool:
    return any(part.startswith(SEQUENCE_SPLIT_PREFIX) for part in split_reason.split(COMPOUND_SPLIT_SEPARATOR))


def _split_reason_has_action_object(split_reason: str) -> bool:
    return any(part.startswith(ACTION_OBJECT_SPLIT_PREFIX) for part in split_reason.split(COMPOUND_SPLIT_SEPARATOR))


def _split_reason_has_action(split_reason: str) -> bool:
    return any(part.startswith(ACTION_SPLIT_PREFIX) for part in split_reason.split(COMPOUND_SPLIT_SEPARATOR))


def _regenerated_split_label(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    frame_candidate = _action_object_label_candidate(member_ids, preprocessed_index)
    candidates: list[dict[str, Any]] = []
    frame_terms = _string_list(frame_candidate.get("terms"))
    term_terms = _split_label_terms(member_ids, preprocessed_index)
    if frame_terms:
        candidates.append(
            _score_split_label_candidate(
                name=str(frame_candidate.get("name") or ""),
                terms=frame_terms,
                member_ids=member_ids,
                preprocessed_index=preprocessed_index,
                source=str(frame_candidate.get("source") or "action_object_frame"),
                frame_candidate=frame_candidate,
            )
        )
    else:
        action_candidate = _action_only_label_candidate(member_ids, preprocessed_index)
        action_terms = _string_list(action_candidate.get("terms"))
        if action_terms and _should_use_action_only_label_candidate(term_terms):
            candidates.append(
                _score_split_label_candidate(
                    name=str(action_candidate.get("name") or ""),
                    terms=action_terms,
                    member_ids=member_ids,
                    preprocessed_index=preprocessed_index,
                    source=str(action_candidate.get("source") or "action_frame_action"),
                    frame_candidate=action_candidate,
                )
            )
    if term_terms and not frame_terms:
        term_action_candidate = _term_frequency_action_label_candidate(member_ids, preprocessed_index, term_terms)
        term_action_terms = _string_list(term_action_candidate.get("terms"))
        if term_action_terms:
            candidates.append(
                _score_split_label_candidate(
                    name=str(term_action_candidate.get("name") or ""),
                    terms=term_action_terms,
                    member_ids=member_ids,
                    preprocessed_index=preprocessed_index,
                    source=str(term_action_candidate.get("source") or "term_frequency_action"),
                    frame_candidate={},
                )
            )
    if term_terms:
        term_label_name, term_label_terms = _term_frequency_label_payload(term_terms)
        candidates.append(
            _score_split_label_candidate(
                name=term_label_name,
                terms=term_label_terms,
                member_ids=member_ids,
                preprocessed_index=preprocessed_index,
                source="term_frequency",
                frame_candidate={},
            )
        )
    candidates = _dedupe_split_label_candidates(candidates)
    if not candidates:
        return {"name": "", "score": 0.0, "evidenceCoverage": 0.0, "candidates": []}
    candidates.sort(key=lambda item: (-_float_value(item.get("score"), default=0.0), str(item.get("name") or "")))
    best = candidates[0]
    return {
        "name": best["name"],
        "score": best["score"],
        "evidenceCoverage": best["evidenceCoverage"],
        "memberEvidenceCoverage": best.get("memberEvidenceCoverage", best["evidenceCoverage"]),
        "objectCoverage": best.get("objectCoverage", 0.0),
        "actionCoverage": best.get("actionCoverage", 0.0),
        "objectActionJointCoverage": best.get("objectActionJointCoverage", 0.0),
        "actionObjectValidity": best["actionObjectValidity"],
        "specificity": best.get("specificity", 0.0),
        "actionObjectFrame": best.get("actionObjectFrame", {}),
        "candidates": [
            {key: value for key, value in candidate.items() if key not in {"terms", "actionObjectFrame"}}
            for candidate in candidates[:5]
        ],
    }


def _review_safe_generated_label(
    label: dict[str, Any],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    split_key: str,
) -> dict[str, Any]:
    if _is_grounded_generated_label(label, split_key):
        return label
    noise_reduced_name = _noise_reduced_review_label(label)
    has_structured_noise_reduced_label = _is_review_label_structurally_grounded(
        noise_reduced_name,
        member_ids,
        preprocessed_index,
    )
    if not has_structured_noise_reduced_label and not _is_clean_review_label_base(noise_reduced_name):
        noise_reduced_name = ""
    fallback_name = noise_reduced_name or _flow_grounded_review_label(member_ids, preprocessed_index, split_key)
    fallback_name = _action_augmented_review_label(fallback_name, split_key, member_ids, preprocessed_index)
    fallback_source = "noise_reduced_review_fallback" if noise_reduced_name else "weak_label_flow_fallback"
    fallback_score_cap = 0.55 if noise_reduced_name else 0.45
    original_score = _float_value(label.get("score"), default=0.0)
    fallback_score = min(original_score, fallback_score_cap) if original_score > 0.0 else 0.35
    review_metrics = _review_label_metrics(
        fallback_name,
        member_ids,
        preprocessed_index,
        base_action_object_validity=_float_value(label.get("actionObjectValidity"), default=0.35),
    )
    fallback_score = min(max(fallback_score, review_metrics["score"]), fallback_score_cap)
    return {
        **label,
        "name": fallback_name,
        "score": fallback_score,
        "evidenceCoverage": review_metrics["evidenceCoverage"],
        "memberEvidenceCoverage": review_metrics["memberEvidenceCoverage"],
        "objectCoverage": review_metrics["objectCoverage"],
        "actionCoverage": review_metrics["actionCoverage"],
        "objectActionJointCoverage": review_metrics["objectActionJointCoverage"],
        "actionObjectValidity": review_metrics["actionObjectValidity"],
        "specificity": review_metrics["specificity"],
        "candidates": [
            {
                "name": fallback_name,
                "score": fallback_score,
                "source": fallback_source,
                "evidenceCoverage": review_metrics["evidenceCoverage"],
                "memberEvidenceCoverage": review_metrics["memberEvidenceCoverage"],
                "objectCoverage": review_metrics["objectCoverage"],
                "actionCoverage": review_metrics["actionCoverage"],
                "objectActionJointCoverage": review_metrics["objectActionJointCoverage"],
                "actionObjectValidity": review_metrics["actionObjectValidity"],
                "specificity": review_metrics["specificity"],
            },
            *_dict_candidates(label.get("candidates")),
        ][:5],
    }


def _split_label_auto_acceptable(label: dict[str, Any]) -> bool:
    score = _float_value(label.get("score"), default=0.0)
    evidence_coverage = _float_value(label.get("evidenceCoverage"), default=0.0)
    object_action_joint_coverage = _float_value(label.get("objectActionJointCoverage"), default=0.0)
    action_object_validity = _float_value(label.get("actionObjectValidity"), default=0.35)
    specificity = _float_value(label.get("specificity"), default=0.0)
    raw_terms = [
        term.casefold()
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", str(label.get("name") or "").casefold())
        if term.casefold() != "문의"
    ]
    terms = [_clean_label_component_term(term) for term in raw_terms]
    meaningful_terms = [term for term in terms if term and _is_label_component_term(term)]
    object_terms, action_terms = _label_object_action_terms(meaningful_terms)
    if score < 0.65:
        return False
    if _has_label_review_noise(meaningful_terms) or _has_auto_label_raw_noise(raw_terms):
        return False
    if not object_terms or not action_terms:
        return False
    if any(term in AUTO_REVIEW_ONLY_ACTION_TERMS for term in action_terms):
        return False
    if _has_broad_generic_action_label(object_terms, action_terms):
        return False
    if not _has_strong_auto_object_term(object_terms):
        return False
    if evidence_coverage < AUTO_SPLIT_LABEL_EVIDENCE_COVERAGE:
        return False
    return (
        object_action_joint_coverage >= AUTO_SPLIT_LABEL_OBJECT_ACTION_JOINT_COVERAGE
        and action_object_validity >= AUTO_SPLIT_LABEL_ACTION_OBJECT_VALIDITY
        and specificity >= AUTO_SPLIT_LABEL_SPECIFICITY
    )


def _has_auto_label_raw_noise(raw_terms: list[str]) -> bool:
    for term in raw_terms:
        raw = term.strip().casefold()
        normalized = _clean_label_term(raw) or raw
        if raw in LABEL_REVIEW_NOISE_TERMS:
            return True
        if normalized in LABEL_REVIEW_NOISE_TERMS:
            return True
        if any(raw.endswith(suffix) for suffix in LABEL_RAW_REVIEW_NOISE_SUFFIXES):
            return True
    return False


def _has_broad_generic_action_label(object_terms: tuple[str, ...], action_terms: tuple[str, ...]) -> bool:
    if not action_terms or any(term not in AUTO_GENERIC_ACTION_TERMS for term in action_terms):
        return False
    return not any(
        len(term.replace("_", "")) >= AUTO_MIN_SPECIFIC_OBJECT_LENGTH_FOR_GENERIC_ACTION for term in object_terms
    )


def _has_strong_auto_object_term(object_terms: tuple[str, ...]) -> bool:
    return any(term not in AUTO_WEAK_OBJECT_TERMS for term in object_terms)


def _is_grounded_generated_label(label: dict[str, Any], split_key: str) -> bool:
    name = str(label.get("name") or "").strip()
    if not name:
        return False
    score = _float_value(label.get("score"), default=0.0)
    evidence_coverage = _float_value(label.get("evidenceCoverage"), default=0.0)
    action_object_validity = _float_value(label.get("actionObjectValidity"), default=0.35)
    source = _label_candidate_source(label)
    raw_terms = [
        term.casefold() for term in re.findall(r"[0-9A-Za-z가-힣_]+", name.casefold()) if term.casefold() != "문의"
    ]
    terms = [_clean_label_component_term(term) for term in raw_terms]
    meaningful_terms = [term for term in terms if term and _is_label_component_term(term)]
    if not meaningful_terms:
        return False
    if _has_label_review_noise(meaningful_terms) or _has_auto_label_raw_noise(raw_terms):
        return False
    if source == "term_frequency":
        has_action_term = any(_is_action_label_term(term) for term in meaningful_terms)
        action_terms = [term for term in meaningful_terms if _is_action_label_term(term)]
        has_only_ambiguous_action = (
            bool(action_terms)
            and len(meaningful_terms) == len(action_terms)
            and all(term in ACTION_OBJECT_AMBIGUOUS_TERMS for term in action_terms)
        )
        has_multi_term_grounding = (
            len(meaningful_terms) >= 2 and evidence_coverage >= MIN_GROUNDED_LABEL_EVIDENCE_COVERAGE
        )
        if has_only_ambiguous_action:
            return False
        if has_action_term and evidence_coverage >= 0.20:
            return True
        return has_multi_term_grounding and score >= MIN_GROUNDED_TERM_FREQUENCY_SCORE
    if source == "action_object_frame":
        object_action_joint_coverage = _float_value(label.get("objectActionJointCoverage"), default=0.0)
        return (
            action_object_validity >= 0.60
            and evidence_coverage >= MIN_GROUNDED_LABEL_EVIDENCE_COVERAGE
            and object_action_joint_coverage >= 0.35
        )
    if source == "action_frame_action":
        return action_object_validity >= 0.55 and evidence_coverage >= 0.50 and score >= 0.55
    return score >= MIN_GROUNDED_TERM_FREQUENCY_SCORE and evidence_coverage >= MIN_GROUNDED_LABEL_EVIDENCE_COVERAGE


def _has_label_review_noise(terms: list[str]) -> bool:
    return any(term in LABEL_REVIEW_NOISE_TERMS for term in terms)


def _noise_reduced_review_label(label: dict[str, Any]) -> str:
    raw_terms = [
        _clean_label_term(term)
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", str(label.get("name") or "").casefold())
        if term.casefold() != "문의"
    ]
    terms = [term for term in raw_terms if term and _is_split_label_term(term)]
    if not terms:
        return ""
    core_terms = [term for term in terms if term not in LABEL_REVIEW_NOISE_TERMS]
    if not core_terms:
        return ""
    action_terms = [term for term in core_terms if _is_action_label_term(term)]
    if action_terms and len(core_terms) == 1:
        return f"{action_terms[0]} 문의"
    compacted = _compact_label_terms(core_terms)[:2]
    if not compacted:
        return ""
    return f"{' '.join(compacted)} 문의"


def _is_review_label_structurally_grounded(
    name: str,
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> bool:
    if not name:
        return False
    raw_terms = [
        term.casefold() for term in re.findall(r"[0-9A-Za-z가-힣_]+", name.casefold()) if term.casefold() != "문의"
    ]
    terms = _label_terms_from_name(name)
    if not terms or _has_auto_label_raw_noise(raw_terms) or _has_label_review_noise(terms):
        return False
    object_terms, action_terms = _label_object_action_terms(terms)
    if action_terms and not object_terms:
        return not any(
            term in AUTO_REVIEW_ONLY_ACTION_TERMS or term in AUTO_GENERIC_ACTION_TERMS for term in action_terms
        )
    if not object_terms or not action_terms:
        return False
    if any(term in AUTO_REVIEW_ONLY_ACTION_TERMS for term in action_terms):
        return False
    if _has_broad_generic_action_label(object_terms, action_terms):
        return False
    _object_coverage, _action_coverage, joint_coverage = _label_component_coverages(
        terms,
        member_ids,
        preprocessed_index,
    )
    return joint_coverage >= 0.45


def _is_clean_review_label_base(name: str) -> bool:
    if not name:
        return False
    raw_terms = [
        term.casefold() for term in re.findall(r"[0-9A-Za-z가-힣_]+", name.casefold()) if term.casefold() != "문의"
    ]
    terms = _label_terms_from_name(name)
    if not terms or _has_auto_label_raw_noise(raw_terms) or _has_label_review_noise(terms):
        return False
    object_terms, action_terms = _label_object_action_terms(terms)
    if action_terms and not object_terms:
        return not any(
            term in AUTO_REVIEW_ONLY_ACTION_TERMS or term in AUTO_GENERIC_ACTION_TERMS for term in action_terms
        )
    if action_terms and any(term in AUTO_REVIEW_ONLY_ACTION_TERMS for term in action_terms):
        return False
    if action_terms and _has_broad_generic_action_label(object_terms, action_terms):
        return False
    return bool(object_terms)


def _action_augmented_review_label(
    fallback_name: str,
    split_key: str,
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> str:
    terms = _label_terms_from_name(fallback_name)
    object_terms, action_terms = _label_object_action_terms(terms)
    if not object_terms or action_terms:
        return fallback_name
    for action in _split_key_action_terms(split_key):
        if action in AUTO_REVIEW_ONLY_ACTION_TERMS:
            continue
        if action in object_terms:
            return fallback_name
        action_coverage = _component_coverage((action,), member_ids, preprocessed_index)
        if action_coverage < 0.30:
            continue
        object_label = " ".join(_compact_label_terms(list(object_terms))[:2])
        if object_label:
            return f"{object_label} {action} 문의"
    return fallback_name


def _split_key_action_terms(split_key: str) -> list[str]:
    actions: list[str] = []
    for part in split_key.split(COMPOUND_SPLIT_SEPARATOR):
        action = ""
        if part.startswith(ACTION_SPLIT_PREFIX):
            action = part.removeprefix(ACTION_SPLIT_PREFIX).strip()
        elif part.startswith(ACTION_OBJECT_SPLIT_PREFIX):
            raw = part.removeprefix(ACTION_OBJECT_SPLIT_PREFIX)
            if ">" in raw:
                _object_term, action = raw.split(">", 1)
                action = action.strip()
        action = _clean_label_component_term(action)
        if action and _is_action_label_term(action) and action not in actions:
            actions.append(action)
    return actions


def _review_label_metrics(
    name: str,
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    base_action_object_validity: float,
) -> dict[str, float]:
    terms = _label_terms_from_name(name)
    evidence_coverage = _split_label_evidence_coverage(terms, member_ids, preprocessed_index)
    object_coverage, action_coverage, object_action_joint_coverage = _label_component_coverages(
        terms,
        member_ids,
        preprocessed_index,
    )
    object_terms, action_terms = _label_object_action_terms(terms)
    if object_terms and action_terms:
        action_object_validity = max(0.55, min(base_action_object_validity, 0.85))
    elif object_terms or action_terms:
        action_object_validity = 0.35
    else:
        action_object_validity = 0.25
    specificity = _label_specificity(terms)
    readability = 1.0 if len(name) <= 28 else 0.6
    weak_penalty = _weak_label_penalty(name)
    score = round(
        max(
            0.0,
            (0.34 * evidence_coverage)
            + (0.20 * object_action_joint_coverage)
            + (0.17 * action_object_validity)
            + (0.12 * readability)
            + (0.17 * specificity)
            - (0.35 * weak_penalty),
        ),
        4,
    )
    return {
        "score": score,
        "evidenceCoverage": evidence_coverage,
        "memberEvidenceCoverage": evidence_coverage,
        "objectCoverage": object_coverage,
        "actionCoverage": action_coverage,
        "objectActionJointCoverage": object_action_joint_coverage,
        "actionObjectValidity": action_object_validity,
        "specificity": specificity,
    }


def _label_terms_from_name(name: str) -> list[str]:
    output: list[str] = []
    for raw_term in re.findall(r"[0-9A-Za-z가-힣_]+", name.casefold()):
        if raw_term.casefold() in REVIEW_LABEL_SCAFFOLD_TERMS:
            continue
        term = _clean_label_component_term(raw_term)
        if not term or term in REVIEW_LABEL_SCAFFOLD_TERMS:
            continue
        if _is_label_component_term(term):
            output.append(term)
    return _compact_label_terms(output)


def _label_candidate_source(label: dict[str, Any]) -> str:
    candidates = label.get("candidates")
    if isinstance(candidates, list):
        for candidate in candidates:
            if isinstance(candidate, dict):
                source = candidate.get("source")
                if isinstance(source, str) and source:
                    return source
    return ""


def _dict_candidates(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _flow_grounded_review_label(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    split_key: str,
) -> str:
    action_part = _first_split_part(split_key, ACTION_SPLIT_PREFIX)
    if action_part:
        return f"{_action_split_label(action_part)} 문의"
    action_object_part = _first_split_part(split_key, ACTION_OBJECT_SPLIT_PREFIX)
    if action_object_part:
        return _action_object_split_intent_label(action_object_part)
    if split_key.startswith(SEQUENCE_SPLIT_PREFIX):
        return _review_label_from_sequence_key(split_key)
    dominant_sequence_key = _dominant_event_sequence_key(member_ids, preprocessed_index)
    if dominant_sequence_key:
        return _review_label_from_sequence_key(dominant_sequence_key)
    return REVIEW_PLACEHOLDER_LABEL


def _first_split_part(split_key: str, prefix: str) -> str:
    for part in split_key.split(COMPOUND_SPLIT_SEPARATOR):
        if part.startswith(prefix):
            return part
    return ""


def _dominant_event_sequence_key(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> str:
    counts: Counter[str] = Counter()
    for conv_id in member_ids:
        key = _event_sequence_key(preprocessed_index.get(conv_id), max_events=2)
        if key != f"{SEQUENCE_SPLIT_PREFIX}unknown":
            counts[key] += 1
    if not counts:
        return ""
    return counts.most_common(1)[0][0]


def _review_label_from_sequence_key(sequence_key: str) -> str:
    del sequence_key
    return REVIEW_PLACEHOLDER_LABEL


def _action_object_split_intent_label(split_key: str) -> str:
    raw = split_key.removeprefix(ACTION_OBJECT_SPLIT_PREFIX)
    if ">" not in raw:
        return REVIEW_PLACEHOLDER_LABEL
    object_term, action = raw.split(">", 1)
    object_term = _clean_label_component_term(object_term.strip())
    action = _clean_label_component_term(action.strip())
    if object_term and action:
        return f"{object_term} {action} 문의"
    if action:
        return f"{action} 문의"
    if object_term:
        return f"{object_term} 문의"
    return REVIEW_PLACEHOLDER_LABEL


def _resolve_duplicate_generated_labels(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
) -> None:
    clusters_by_label: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for cluster in clusters:
        label = _workflow_label(cluster)
        if label:
            clusters_by_label[label].append(cluster)
    existing_labels = set(clusters_by_label)
    for label, duplicate_clusters in clusters_by_label.items():
        if len(duplicate_clusters) <= 1:
            continue
        ranked = sorted(
            duplicate_clusters,
            key=lambda cluster: (
                -_float_value(cluster.get("label_score"), default=0.0),
                -_float_value(cluster.get("label_evidence_coverage"), default=0.0),
                -len(_string_list(cluster.get("member_conv_ids"))),
                str(cluster.get("workflow_entrypoint_id") or ""),
            ),
        )
        for duplicate in ranked[1:]:
            if not _should_fallback_duplicate_label(duplicate):
                duplicate["label_validation_status"] = "needs_review"
                continue
            member_ids = _string_list(duplicate.get("member_conv_ids"))
            split_key = str(duplicate.get("flow_split_key") or "single_flow")
            fallback_name = _flow_grounded_review_label(member_ids, preprocessed_index, split_key)
            if fallback_name == label or fallback_name in existing_labels:
                fallback_name = _unique_duplicate_fallback_name(fallback_name, existing_labels)
            existing_labels.add(fallback_name)
            original_score = _float_value(duplicate.get("label_score"), default=0.0)
            duplicate["suggested_name"] = fallback_name
            duplicate["label_source"] = "duplicate_weak_label_flow_fallback"
            duplicate["label_score"] = min(original_score, 0.45) if original_score > 0.0 else 0.35
            duplicate["label_validation_status"] = "needs_review"
            duplicate["label_candidates"] = [
                {
                    "name": fallback_name,
                    "score": duplicate["label_score"],
                    "source": "duplicate_weak_label_flow_fallback",
                    "evidenceCoverage": _float_value(duplicate.get("label_evidence_coverage"), default=0.0),
                    "memberEvidenceCoverage": _float_value(
                        duplicate.get("label_member_evidence_coverage"),
                        default=0.0,
                    ),
                    "objectCoverage": _float_value(duplicate.get("label_object_coverage"), default=0.0),
                    "actionCoverage": _float_value(duplicate.get("label_action_coverage"), default=0.0),
                    "objectActionJointCoverage": _float_value(
                        duplicate.get("label_object_action_joint_coverage"),
                        default=0.0,
                    ),
                    "actionObjectValidity": _float_value(
                        duplicate.get("label_action_object_validity"),
                        default=0.35,
                    ),
                },
                *_dict_candidates(duplicate.get("label_candidates")),
            ][:5]


def _enforce_review_only_labels(clusters: list[dict[str, Any]]) -> None:
    for cluster in clusters:
        if cluster.get("is_novel_outlier_candidate") is True:
            cluster["label_validation_status"] = "needs_review"


def _should_fallback_duplicate_label(cluster: dict[str, Any]) -> bool:
    if _has_evidence_backed_duplicate_label(cluster):
        return False
    score = _float_value(cluster.get("label_score"), default=0.0)
    action_object_validity = _float_value(cluster.get("label_action_object_validity"), default=0.35)
    split_key = str(cluster.get("flow_split_key") or "")
    return score < 0.70 or action_object_validity < 0.55 or _is_mixed_residual_reason(split_key)


def _has_evidence_backed_duplicate_label(cluster: dict[str, Any]) -> bool:
    score = _float_value(cluster.get("label_score"), default=0.0)
    member_coverage = _float_value(cluster.get("label_member_evidence_coverage"), default=0.0)
    joint_coverage = _float_value(cluster.get("label_object_action_joint_coverage"), default=0.0)
    action_object_validity = _float_value(cluster.get("label_action_object_validity"), default=0.35)
    terms = _workflow_label_terms(cluster)
    object_terms, action_terms = _label_object_action_terms(terms)
    has_component_grounding = bool(object_terms and action_terms) and member_coverage >= 0.50 and joint_coverage >= 0.50
    return (
        score >= 0.50
        and member_coverage >= 0.30
        and joint_coverage >= 0.35
        and (action_object_validity >= 0.55 or has_component_grounding)
        and not _has_label_review_noise(terms)
    )


def _workflow_label_terms(cluster: dict[str, Any]) -> list[str]:
    return [
        term
        for term in (
            _clean_label_term(raw_term)
            for raw_term in re.findall(r"[0-9A-Za-z가-힣_]+", _workflow_label(cluster).casefold())
            if raw_term.casefold() != "문의"
        )
        if term and _is_split_label_term(term)
    ]


def _unique_duplicate_fallback_name(base_name: str, existing_labels: set[str]) -> str:
    normalized_base = base_name.removesuffix(" 문의").strip() if base_name.endswith(" 문의") else base_name.strip()
    if normalized_base.endswith(" 검토"):
        normalized_base = normalized_base.removesuffix(" 검토").strip()
    base_label = f"{normalized_base} 문의" if normalized_base else REVIEW_PLACEHOLDER_LABEL
    if base_label not in existing_labels:
        return base_label
    index = 2
    while True:
        candidate = f"{base_label} {index}"
        if candidate not in existing_labels:
            return candidate
        index += 1


def _score_split_label_candidate(
    *,
    name: str,
    terms: list[str],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    source: str,
    frame_candidate: dict[str, Any],
) -> dict[str, Any]:
    evidence_coverage = _candidate_evidence_coverage(frame_candidate, terms, member_ids, preprocessed_index)
    object_coverage, action_coverage, object_action_joint_coverage = _label_component_coverages(
        terms,
        member_ids,
        preprocessed_index,
    )
    readability = 1.0 if len(name) <= 28 else 0.6
    action_object_validity = _action_object_label_validity(frame_candidate)
    specificity = _label_specificity(terms)
    weak_penalty = _weak_label_penalty(name)
    score = round(
        max(
            0.0,
            (0.28 * evidence_coverage)
            + (0.24 * object_action_joint_coverage)
            + (0.22 * action_object_validity)
            + (0.11 * readability)
            + (0.15 * specificity)
            - (0.35 * weak_penalty),
        ),
        4,
    )
    if object_action_joint_coverage < 0.25:
        score = round(score * 0.82, 4)
    return {
        "name": name,
        "score": score,
        "evidenceCoverage": evidence_coverage,
        "memberEvidenceCoverage": evidence_coverage,
        "objectCoverage": object_coverage,
        "actionCoverage": action_coverage,
        "objectActionJointCoverage": object_action_joint_coverage,
        "actionObjectValidity": action_object_validity,
        "terms": terms,
        "actionObjectFrame": frame_candidate.get("frame", {}),
        "source": source,
        "specificity": specificity,
    }


def _candidate_evidence_coverage(
    frame_candidate: dict[str, Any],
    terms: list[str],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    override = frame_candidate.get("evidenceCoverage")
    if isinstance(override, (int, float)) and not isinstance(override, bool):
        return _clamp(float(override))
    return _split_label_evidence_coverage(terms, member_ids, preprocessed_index)


def _label_component_coverages(
    terms: list[str],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> tuple[float, float, float]:
    object_terms, action_terms = _label_object_action_terms(terms)
    return (
        _component_coverage(object_terms, member_ids, preprocessed_index),
        _component_coverage(action_terms, member_ids, preprocessed_index),
        _object_action_joint_coverage(object_terms, action_terms, member_ids, preprocessed_index),
    )


def _label_object_action_terms(terms: list[str]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    cleaned_terms = tuple(term for term in terms if _is_split_label_term(term) or _is_action_label_term(term))
    action_terms = tuple(term for term in cleaned_terms if _is_action_label_term(term))
    object_terms = tuple(term for term in cleaned_terms if term not in action_terms)
    if not object_terms and len(action_terms) == 1 and action_terms[0] in ACTION_OBJECT_AMBIGUOUS_TERMS:
        return action_terms, ()
    if not object_terms and len(action_terms) >= 2:
        return action_terms[:-1], action_terms[-1:]
    return object_terms, action_terms


def _component_coverage(
    terms: tuple[str, ...],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    if not terms or not member_ids:
        return 0.0
    scores: list[float] = []
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _label_source_text(conversation).casefold()
        scores.append(1.0 if any(_term_supported_by_text(text, term) for term in terms) else 0.0)
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 4)


def _object_action_joint_coverage(
    object_terms: tuple[str, ...],
    action_terms: tuple[str, ...],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    if not action_terms or not member_ids:
        return 0.0
    if not object_terms:
        return _component_coverage(action_terms, member_ids, preprocessed_index)
    scores: list[float] = []
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _label_source_text(conversation).casefold()
        object_supported = any(_term_supported_by_text(text, term) for term in object_terms)
        action_supported = any(_term_supported_by_text(text, term) for term in action_terms)
        scores.append(1.0 if object_supported and action_supported else 0.0)
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 4)


def _dedupe_split_label_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in candidates:
        name = str(candidate.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        candidate["name"] = name
        output.append(candidate)
    return output


def _term_supported_by_text(text: str, term: str) -> bool:
    normalized_term = term.casefold()
    if normalized_term in text:
        return True
    aliases = ACTION_TERM_SUPPORT_ALIASES.get(normalized_term)
    if aliases and any(alias in text for alias in aliases):
        return True
    if normalized_term == "정보확인":
        return "정보" in text or "확인" in text
    if normalized_term == "가능여부":
        return "가능" in text or "여부" in text
    return False


def _action_object_label_candidate(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    frame = _dominant_action_object_frame(member_ids, preprocessed_index)
    object_term = _frame_object_value(frame)
    action = _frame_value(frame, "action")
    object_terms = object_term.split()
    terms = [*object_terms, *([action] if action and action not in object_terms else [])]
    if len(terms) < 2:
        return {}
    if action in object_term:
        name = f"{object_term} 문의"
        terms = [object_term]
    else:
        name = f"{object_term} {action} 문의"
    return {"name": name, "terms": terms, "frame": frame, "source": "action_object_frame"}


def _action_only_label_candidate(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    frame = _dominant_action_frame(member_ids, preprocessed_index)
    action = _frame_value(frame, "action")
    if not action or action == "확인":
        return {}
    support_ratio = _float_value(frame.get("memberSupportRatio"), default=0.0)
    if support_ratio < 0.50:
        return {}
    return {
        "name": f"{action} 문의",
        "terms": [action],
        "frame": frame,
        "source": "action_frame_action",
        "evidenceCoverage": support_ratio,
    }


def _should_use_action_only_label_candidate(term_terms: list[str]) -> bool:
    if not term_terms:
        return True
    for term in term_terms:
        if _is_action_label_term(term):
            continue
        if term in ACTION_ONLY_FALLBACK_NOISE_TERMS:
            continue
        return False
    return True


def _term_frequency_action_label_candidate(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    term_terms: list[str],
) -> dict[str, Any]:
    object_terms, action_terms = _label_object_action_terms(term_terms)
    if not object_terms or action_terms:
        return {}
    if all(term in ACTION_OBJECT_AMBIGUOUS_TERMS or _is_action_label_term(term) for term in object_terms):
        return {}
    action = _dominant_text_action(member_ids, preprocessed_index)
    if not action:
        return {}
    object_label_terms = list(object_terms[:2])
    if action in object_label_terms:
        return {}
    return {
        "name": f"{' '.join(object_label_terms)} {action} 문의",
        "terms": [*object_label_terms, action],
        "source": "term_frequency_action",
    }


def _term_frequency_label_payload(term_terms: list[str]) -> tuple[str, list[str]]:
    object_terms, action_terms = _label_object_action_terms(term_terms)
    ordered_terms: list[str] = []
    if object_terms and action_terms:
        ordered_terms = [*list(object_terms[:2]), action_terms[0]]
    elif object_terms:
        ordered_terms = list(object_terms[:2])
    elif action_terms:
        ordered_terms = list(action_terms[:2])
    if not ordered_terms:
        ordered_terms = term_terms[:2]
    ordered_terms = _compact_label_terms(ordered_terms)
    return f"{' '.join(ordered_terms)} 문의", ordered_terms


def _dominant_text_action(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> str:
    if not member_ids:
        return ""
    candidates = list(dict.fromkeys([*ACTION_LABEL_HINTS, *ACTION_TERM_SUPPORT_ALIASES]))
    scored: list[tuple[float, float, str]] = []
    for action in candidates:
        if (
            not action
            or action == "확인"
            or action in AUTO_REVIEW_ONLY_ACTION_TERMS
            or action in TEXT_INFERRED_ACTION_BLOCKLIST
        ):
            continue
        coverage = _component_coverage((action,), member_ids, preprocessed_index)
        if coverage < 0.45:
            continue
        generic_penalty = 0.10 if action in AUTO_GENERIC_ACTION_TERMS else 0.0
        specificity_bonus = min(len(action.replace("_", "")) / 20, 0.08)
        scored.append((coverage - generic_penalty + specificity_bonus, coverage, action))
    if not scored:
        return ""
    scored.sort(reverse=True)
    return scored[0][2]


def _dominant_action_object_frame(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    counts: Counter[tuple[str, str]] = Counter()
    for conv_id in member_ids:
        row = preprocessed_index.get(conv_id)
        if not isinstance(row, dict):
            continue
        frame = row.get("action_object_frame")
        if not isinstance(frame, dict):
            continue
        if _frame_confidence(frame) < 0.65:
            continue
        object_term = _frame_object_value(frame)
        action = _frame_value(frame, "action")
        if not object_term or not action or not _is_split_label_term(object_term) or not _is_action_label_term(action):
            continue
        key = (object_term, action)
        counts[key] += 1
        grouped.setdefault(key, dict(frame))
    if not counts:
        return {}
    key, support = counts.most_common(1)[0]
    frame = grouped[key]
    frame["memberSupport"] = support
    frame["memberSupportRatio"] = round(support / len(member_ids), 4) if member_ids else 0.0
    return frame


def _dominant_action_frame(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    grouped: dict[str, dict[str, Any]] = {}
    counts: Counter[str] = Counter()
    for conv_id in member_ids:
        row = preprocessed_index.get(conv_id)
        if not isinstance(row, dict):
            continue
        frame = row.get("action_object_frame")
        if not isinstance(frame, dict):
            continue
        if _frame_confidence(frame) < 0.65:
            continue
        action = _frame_value(frame, "action")
        if not action or not _is_action_label_term(action):
            continue
        counts[action] += 1
        grouped.setdefault(action, dict(frame))
    if not counts:
        return {}
    action, support = counts.most_common(1)[0]
    frame = grouped[action]
    frame["object"] = ""
    frame["action"] = action
    frame["memberSupport"] = support
    frame["memberSupportRatio"] = round(support / len(member_ids), 4) if member_ids else 0.0
    return frame


def _frame_value(frame: dict[str, Any], key: str) -> str:
    value = frame.get(key)
    return str(value).strip().casefold() if isinstance(value, str) else ""


def _frame_object_value(frame: dict[str, Any]) -> str:
    value = _frame_value(frame, "object")
    terms: list[str] = []
    for raw_term in re.findall(r"[0-9A-Za-z가-힣_]+", value):
        term = _clean_label_term(raw_term)
        if term in FRAME_OBJECT_NOISE_TERMS:
            continue
        if not _is_split_label_term(term):
            continue
        if term not in terms:
            terms.append(term)
    return " ".join(_compact_label_terms(terms)[:4])


def _frame_confidence(frame: dict[str, Any]) -> float:
    value = frame.get("confidence")
    return _clamp(float(value)) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.0


def _action_object_label_validity(frame_candidate: dict[str, Any]) -> float:
    frame = frame_candidate.get("frame")
    if not isinstance(frame, dict):
        return 0.35
    object_term = _frame_object_value(frame)
    action = _frame_value(frame, "action")
    support_ratio = _float_value(frame.get("memberSupportRatio"), default=0.0)
    if object_term and action:
        return _clamp(0.70 + (0.30 * support_ratio))
    if object_term or action:
        return 0.55
    return 0.25


def _split_label_terms(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> list[str]:
    counter: Counter[str] = Counter()
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _label_source_text(conversation)
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", text.casefold()):
            term = _clean_label_term(term)
            if not _is_split_label_term(term):
                continue
            counter[term] += 1
    return _compact_label_terms([term for term, _count in counter.most_common(4)])[:2]


def _clean_label_term(term: str) -> str:
    cleaned = term.strip().casefold()
    normalized_query_term = _normalize_query_value_term(cleaned)
    if normalized_query_term:
        return normalized_query_term
    if cleaned in _LABEL_STOPWORDS:
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
    cleaned = _normalize_action_inflected_term(cleaned)
    normalized_query_term = _normalize_query_value_term(cleaned)
    if normalized_query_term:
        return normalized_query_term
    if cleaned in _LABEL_STOPWORDS:
        return ""
    return cleaned


def _clean_label_component_term(term: str) -> str:
    cleaned = _clean_label_term(term)
    if cleaned:
        return cleaned
    raw = term.strip().casefold()
    return raw if _is_action_label_term(raw) else ""


def _normalize_query_value_term(term: str) -> str:
    if term.startswith("얼마"):
        return "금액"
    if term.startswith("얼만"):
        return "금액"
    if term.startswith("돈"):
        return "금액"
    if term.startswith("값"):
        return "금액"
    if term.startswith("인출"):
        return "출금"
    if term.startswith("출금"):
        return "출금"
    if term.startswith("초과"):
        return "초과"
    return ""


def _normalize_action_inflected_term(term: str) -> str:
    for action in ACTION_LABEL_HINTS:
        if term == action:
            return term
        if not term.startswith(action):
            continue
        remainder = term[len(action) :]
        if not remainder:
            return term
        if any(remainder.startswith(suffix) for suffix in ACTION_INFLECTION_SUFFIXES):
            return action
    return term


def _compact_label_terms(terms: list[str]) -> list[str]:
    compacted: list[str] = []
    for term in terms:
        if not _is_split_label_term(term):
            continue
        if any(term == existing for existing in compacted):
            continue
        if any(term in existing and len(existing) > len(term) for existing in compacted):
            continue
        compacted = [existing for existing in compacted if not (existing in term and len(term) > len(existing))]
        compacted.append(term)
    return compacted


def _is_split_label_term(term: str) -> bool:
    if not term or len(term.replace("_", "")) <= 1:
        return False
    if term in _LABEL_STOPWORDS:
        return False
    if any(char.isdigit() for char in term):
        return False
    if re.fullmatch(r"[a-z]{1,3}", term):
        return False
    if re.fullmatch(r"[a-z_]+", term) and term in _LABEL_STOPWORDS:
        return False
    return True


def _label_specificity(terms: list[str]) -> float:
    unique_terms = [term for term in dict.fromkeys(terms) if _is_label_component_term(term)]
    if not unique_terms:
        return 0.0
    if len(unique_terms) == 1:
        return 0.35
    if len(unique_terms) == 2:
        return 0.82
    return 1.0


def _is_action_label_term(term: str) -> bool:
    if not term:
        return False
    return any(hint in term for hint in ACTION_LABEL_HINTS)


def _is_label_component_term(term: str) -> bool:
    return _is_split_label_term(term) or _is_action_label_term(term)


def _split_label_evidence_coverage(
    terms: list[str],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    if not terms or not member_ids:
        return 0.0
    member_scores: list[float] = []
    normalized_terms = [term.casefold() for term in terms if term]
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _label_source_text(conversation).casefold()
        if not text:
            member_scores.append(0.0)
            continue
        hits = sum(1 for term in normalized_terms if _term_supported_by_text(text, term))
        member_scores.append(hits / len(normalized_terms) if normalized_terms else 0.0)
    if not member_scores:
        return 0.0
    return round(sum(member_scores) / len(member_scores), 4)


def _label_source_text(conversation: dict[str, Any]) -> str:
    customer_text = str(conversation.get("customer_problem_text") or "").strip()
    if customer_text:
        return customer_text
    return str(conversation.get("canonical_text") or "").strip()


def _entrypoint(cluster: dict[str, Any], split_reason: str) -> dict[str, Any]:
    source_cluster_ids = cluster.get("source_cluster_ids")
    member_ids = _string_list(cluster.get("member_conv_ids"))
    return {
        "entryPointId": cluster["workflow_entrypoint_id"],
        "intentClusterId": cluster["cluster_id"],
        "sourceClusterId": cluster.get("source_cluster_id"),
        "sourceClusterIds": source_cluster_ids if isinstance(source_cluster_ids, list) else [],
        "memberConversationIds": member_ids,
        "exemplarConversationIds": _string_list(cluster.get("exemplar_conv_ids")),
        "splitReason": split_reason,
        "memberCount": len(member_ids),
        "confidence": _confidence(cluster),
    }


def _apply_entrypoint_semantic_metadata(
    clusters: list[dict[str, Any]],
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> dict[str, float | int]:
    vectors = _load_intent_discovery_embeddings(runtime_config, stage_context)
    if vectors is None or not clusters:
        return _entrypoint_semantic_report([], len(clusters))

    normalized = _l2norm(vectors.astype(np.float32, copy=False))
    cluster_indices = {
        position: [index for index in _int_list(cluster.get("member_indices")) if 0 <= index < normalized.shape[0]]
        for position, cluster in enumerate(clusters)
    }
    centroid_by_position = {
        position: _l2norm(normalized[indices].mean(axis=0, keepdims=True))[0]
        for position, indices in cluster_indices.items()
        if indices
    }
    quality_rows: list[dict[str, object]] = []
    for position, cluster in enumerate(clusters):
        indices = cluster_indices.get(position, [])
        centroid = centroid_by_position.get(position)
        if centroid is None or not indices:
            continue
        members = normalized[indices]
        cohesion = float(np.mean(members @ centroid)) if members.size else 0.0
        nearest = _nearest_entrypoint_centroid(position, centroid, centroid_by_position)
        nearest_position = nearest[0] if nearest is not None else None
        nearest_similarity = nearest[1] if nearest is not None else None
        margin = cohesion - nearest_similarity if nearest_similarity is not None else cohesion
        distinctiveness = _entrypoint_distinctiveness_score(margin)
        nearest_cluster = clusters[nearest_position] if nearest_position is not None else None
        semantic_quality = {
            "memberCount": len(indices),
            "cohesion": round(_clamp(cohesion), 6),
            "nearestCentroidSimilarity": None if nearest_similarity is None else round(_clamp(nearest_similarity), 6),
            "nearestCompetitorWorkflowEntryPointId": _semantic_competitor_value(
                nearest_cluster,
                "workflow_entrypoint_id",
            ),
            "nearestCompetitorClusterId": _semantic_competitor_value(nearest_cluster, "cluster_id"),
            "nearestCompetitorName": _workflow_label(nearest_cluster) if isinstance(nearest_cluster, dict) else None,
            "separationMargin": round(max(-1.0, min(1.0, margin)), 6),
            "distinctiveness": round(distinctiveness, 6),
        }
        cluster["entrypoint_semantic_quality"] = semantic_quality
        quality = cluster.get("quality")
        if not isinstance(quality, dict):
            quality = {}
        else:
            quality = dict(quality)
        quality["entrypoint_semantic_cohesion"] = semantic_quality["cohesion"]
        quality["entrypoint_semantic_separation_margin"] = semantic_quality["separationMargin"]
        quality["entrypoint_semantic_distinctiveness"] = semantic_quality["distinctiveness"]
        cluster["quality"] = quality
        quality_rows.append(semantic_quality)
    return _entrypoint_semantic_report(quality_rows, len(clusters))


def _load_intent_discovery_embeddings(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> np.ndarray | None:
    path = _upstream_stage_dir("intent_discovery", runtime_config, stage_context) / "embeddings.npy"
    if not path.exists():
        return None
    try:
        payload = np.load(path)
    except (OSError, ValueError):
        return None
    if payload.ndim != 2:
        return None
    return payload.astype(np.float32, copy=False)


def _nearest_entrypoint_centroid(
    position: int,
    centroid: np.ndarray,
    centroid_by_position: dict[int, np.ndarray],
) -> tuple[int, float] | None:
    similarities = sorted(
        (
            (other_position, float(centroid @ other_centroid))
            for other_position, other_centroid in centroid_by_position.items()
            if other_position != position
        ),
        key=lambda item: (-item[1], item[0]),
    )
    return similarities[0] if similarities else None


def _semantic_competitor_value(cluster: object, key: str) -> object:
    if not isinstance(cluster, dict):
        return None
    value = cluster.get(key)
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return value
    return None


def _entrypoint_semantic_report(
    rows: list[dict[str, object]],
    total_count: int,
) -> dict[str, float | int]:
    if not rows:
        return {
            "entrypointSemanticCoverage": 0.0,
            "entrypointSemanticCohesion": 0.0,
            "entrypointSemanticSeparationMargin": 0.0,
            "entrypointDistinctiveness": 0.0,
            "entrypointPositiveMarginRate": 0.0,
        }
    cohesion_values = [_float_value(row.get("cohesion"), default=0.0) for row in rows]
    margin_values = [_float_value(row.get("separationMargin"), default=0.0) for row in rows]
    distinctiveness_values = [_float_value(row.get("distinctiveness"), default=0.0) for row in rows]
    return {
        "entrypointSemanticCoverage": len(rows) / total_count if total_count > 0 else 0.0,
        "entrypointSemanticCohesion": sum(cohesion_values) / len(cohesion_values),
        "entrypointSemanticSeparationMargin": sum(margin_values) / len(margin_values),
        "entrypointDistinctiveness": sum(distinctiveness_values) / len(distinctiveness_values),
        "entrypointPositiveMarginRate": sum(1 for value in margin_values if value > 0.0) / len(margin_values),
    }


def _entrypoint_distinctiveness_score(margin: float) -> float:
    return _clamp((margin + 0.02) / 0.12)


def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    if values.size == 0:
        return values
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def _apply_workflow_review_metadata(
    clusters: list[dict[str, Any]],
    entrypoints: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    total_member_count: int,
    min_split_size: int,
) -> None:
    label_counts = Counter(_workflow_label(cluster) for cluster in clusters)
    entrypoint_by_id = {
        str(entrypoint.get("entryPointId")): entrypoint
        for entrypoint in entrypoints
        if isinstance(entrypoint.get("entryPointId"), str)
    }
    for cluster in clusters:
        split_reason = str(cluster.get("flow_split_key") or cluster.get("splitReason") or "single_flow")
        label = _workflow_label(cluster)
        confidence_payload = _workflow_confidence_payload(
            cluster,
            split_reason=split_reason,
            preprocessed_index=preprocessed_index,
            total_member_count=total_member_count,
            min_split_size=min_split_size,
            duplicate_label_count=label_counts[label],
        )
        cluster.update(confidence_payload)
        entrypoint = entrypoint_by_id.get(str(cluster.get("workflow_entrypoint_id")))
        if entrypoint is not None:
            entrypoint["confidence"] = confidence_payload["workflow_confidence"]
            entrypoint["confidenceComponents"] = confidence_payload["workflow_confidence_components"]
            entrypoint["needsHumanReview"] = confidence_payload["needs_human_review"]
            entrypoint["reviewReasonCodes"] = confidence_payload["review_reason_codes"]
            entrypoint["sampleReviewReasonCodes"] = confidence_payload["sample_review_reason_codes"]
            entrypoint["reviewTier"] = confidence_payload["review_tier"]
            entrypoint["coverageShare"] = confidence_payload["coverage_share"]
            semantic_quality = cluster.get("entrypoint_semantic_quality")
            if isinstance(semantic_quality, dict):
                entrypoint["semanticQuality"] = semantic_quality


def _workflow_confidence_payload(
    cluster: dict[str, Any],
    *,
    split_reason: str,
    preprocessed_index: dict[str, dict[str, Any]],
    total_member_count: int,
    min_split_size: int,
    duplicate_label_count: int,
) -> dict[str, Any]:
    member_ids = _string_list(cluster.get("member_conv_ids"))
    low_quality_ratio = _low_quality_member_ratio(member_ids, preprocessed_index)
    coverage_share = len(member_ids) / total_member_count if total_member_count > 0 else 0.0
    support_min_split_size = _support_min_split_size(split_reason, min_split_size)
    components = {
        "semantic": _semantic_confidence(cluster),
        "flow": _flow_confidence(member_ids, preprocessed_index, split_reason),
        "evidence": _evidence_confidence(cluster, member_ids, support_min_split_size),
        "label": _label_confidence(cluster, duplicate_label_count),
        "support": _support_confidence(member_ids, support_min_split_size),
        "safety": max(0.0, 1.0 - low_quality_ratio),
    }
    confidence = round(
        (0.22 * components["semantic"])
        + (0.22 * components["flow"])
        + (0.18 * components["evidence"])
        + (0.16 * components["label"])
        + (0.12 * components["support"])
        + (0.10 * components["safety"]),
        4,
    )
    reason_codes = _review_reason_codes(
        confidence=confidence,
        components=components,
        split_reason=split_reason,
        coverage_share=coverage_share,
        duplicate_label_count=duplicate_label_count,
        low_quality_ratio=low_quality_ratio,
    )
    if cluster.get("is_novel_outlier_candidate") is True:
        reason_codes.append("novel_outlier_candidate")
    weak_semantic_boundary_sample = False
    if _has_weak_entrypoint_semantic_boundary(cluster):
        if _should_sample_weak_entrypoint_semantic_boundary(
            confidence=confidence,
            components=components,
            reason_codes=reason_codes,
        ):
            weak_semantic_boundary_sample = True
        else:
            reason_codes.append("weak_semantic_boundary")
    reason_codes = _dedupe(reason_codes)
    sample_reason_codes = _sample_review_reason_codes(
        components=components,
        duplicate_label_count=duplicate_label_count,
        weak_semantic_boundary_sample=weak_semantic_boundary_sample,
    )
    needs_review = bool(reason_codes)
    return {
        "workflow_confidence": confidence,
        "workflow_confidence_components": components,
        "needs_human_review": needs_review,
        "review_reason_codes": reason_codes,
        "sample_review_reason_codes": sample_reason_codes,
        "review_tier": _review_tier(confidence, needs_review, has_sample_review=bool(sample_reason_codes)),
        "coverage_share": round(coverage_share, 6),
        "duplicate_label_count": duplicate_label_count,
        "low_quality_member_ratio": low_quality_ratio,
        "support_min_split_size": support_min_split_size,
    }


def _support_min_split_size(split_reason: str, min_split_size: int) -> int:
    if COMPOUND_SPLIT_SEPARATOR in split_reason and (
        _split_reason_has_action(split_reason)
        or _split_reason_has_action_object(split_reason)
        or _split_reason_has_sequence(split_reason)
    ):
        return _resolve_expanded_min_split_size(min_split_size)
    return min_split_size


def _semantic_confidence(cluster: dict[str, Any]) -> float:
    quality = cluster.get("quality")
    values: list[float] = []
    if isinstance(quality, dict):
        for key in ("interpretability_score", "workflow_consistency_score", "branching_explainability_score"):
            value = quality.get(key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                values.append(_clamp(float(value)))
        entrypoint_score = _entrypoint_semantic_confidence(quality)
    else:
        entrypoint_score = None
    if values:
        base_score = sum(values) / len(values)
        if entrypoint_score is not None:
            return _clamp((0.72 * base_score) + (0.28 * entrypoint_score))
        return base_score
    return 0.5


def _entrypoint_semantic_confidence(quality: dict[str, Any]) -> float | None:
    cohesion = quality.get("entrypoint_semantic_cohesion")
    distinctiveness = quality.get("entrypoint_semantic_distinctiveness")
    margin = quality.get("entrypoint_semantic_separation_margin")
    if not isinstance(cohesion, (int, float)) or isinstance(cohesion, bool):
        return None
    if not isinstance(distinctiveness, (int, float)) or isinstance(distinctiveness, bool):
        return None
    margin_score = 0.5
    if isinstance(margin, (int, float)) and not isinstance(margin, bool):
        margin_score = _clamp((float(margin) + 0.04) / 0.12)
    return _clamp((0.50 * _clamp(float(cohesion))) + (0.35 * _clamp(float(distinctiveness))) + (0.15 * margin_score))


def _has_weak_entrypoint_semantic_boundary(cluster: dict[str, Any]) -> bool:
    quality = cluster.get("entrypoint_semantic_quality")
    if not isinstance(quality, dict):
        return False
    distinctiveness = quality.get("distinctiveness")
    margin = quality.get("separationMargin")
    if not isinstance(distinctiveness, (int, float)) or isinstance(distinctiveness, bool):
        return False
    if not isinstance(margin, (int, float)) or isinstance(margin, bool):
        return False
    return (
        float(distinctiveness) < MIN_ENTRYPOINT_DISTINCTIVENESS_FOR_SAMPLE
        and float(margin) < MIN_ENTRYPOINT_MARGIN_FOR_SAMPLE
    )


def _should_sample_weak_entrypoint_semantic_boundary(
    *,
    confidence: float,
    components: dict[str, float],
    reason_codes: list[str],
) -> bool:
    if reason_codes:
        return False
    return (
        confidence >= WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD
        and components["flow"] >= 0.60
        and components["evidence"] >= 0.60
        and components["label"] >= WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD
        and components["support"] >= 0.60
    )


def _flow_confidence(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    split_reason: str,
) -> float:
    if not member_ids:
        return 0.0
    if _is_mixed_residual_reason(split_reason):
        return 0.45
    sequence_share = _dominant_sequence_share(member_ids, preprocessed_index)
    signal_share = _dominant_signal_share(member_ids, preprocessed_index)
    return _clamp((0.65 * max(sequence_share, 0.5)) + (0.35 * max(signal_share, 0.5)))


def _dominant_sequence_share(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    counts: Counter[str] = Counter()
    for conv_id in member_ids:
        counts[_event_sequence_key(preprocessed_index.get(conv_id), max_events=3)] += 1
    if not counts:
        return 0.0
    return counts.most_common(1)[0][1] / len(member_ids)


def _dominant_signal_share(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    counts: Counter[str] = Counter()
    for conv_id in member_ids:
        row = preprocessed_index.get(conv_id, {})
        signal = row.get("workflow_signal") if isinstance(row, dict) else {}
        counts[_signal_key(signal if isinstance(signal, dict) else {})] += 1
    if not counts:
        return 0.0
    return counts.most_common(1)[0][1] / len(member_ids)


def _evidence_confidence(
    cluster: dict[str, Any],
    member_ids: list[str],
    min_split_size: int,
) -> float:
    exemplar_count = len(_string_list(cluster.get("exemplar_conv_ids")))
    keyword_count = len(_string_list(cluster.get("keywords")))
    exemplar_score = min(1.0, exemplar_count / 3.0)
    keyword_score = min(1.0, keyword_count / 5.0)
    support_score = _support_confidence(member_ids, min_split_size)
    return _clamp((0.40 * exemplar_score) + (0.30 * keyword_score) + (0.30 * support_score))


def _label_confidence(cluster: dict[str, Any], duplicate_label_count: int) -> float:
    value = cluster.get("label_score")
    base = _clamp(float(value)) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.55
    evidence_value = cluster.get("label_evidence_coverage")
    evidence = (
        _clamp(float(evidence_value))
        if isinstance(evidence_value, (int, float)) and not isinstance(evidence_value, bool)
        else base
    )
    action_value = cluster.get("label_action_object_validity")
    action_object = (
        _clamp(float(action_value))
        if isinstance(action_value, (int, float)) and not isinstance(action_value, bool)
        else 0.55
    )
    base = (0.58 * base) + (0.27 * evidence) + (0.15 * action_object)
    duplicate_penalty = 0.15 if duplicate_label_count > 1 else 0.0
    label = str(cluster.get("suggested_name") or cluster.get("canonical_intent") or "")
    weak_label_penalty = _weak_label_penalty(label)
    return _clamp(base - duplicate_penalty - weak_label_penalty)


def _weak_label_penalty(label: str) -> float:
    terms = [
        _clean_label_component_term(term)
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", label.casefold())
        if term.casefold() != "문의"
    ]
    meaningful_terms = [term for term in terms if term and _is_label_component_term(term)]
    weak_count = len(terms) - len(meaningful_terms)
    if not terms:
        return 0.25
    if len(meaningful_terms) == 0:
        return 0.30
    if len(meaningful_terms) == 1:
        return 0.10 + (0.10 * weak_count / len(terms))
    return min(0.20, 0.12 * weak_count / len(terms))


def _support_confidence(member_ids: list[str], min_split_size: int) -> float:
    if not member_ids:
        return 0.0
    return min(1.0, len(member_ids) / max(1, min_split_size * 1.5))


def _review_reason_codes(
    *,
    confidence: float,
    components: dict[str, float],
    split_reason: str,
    coverage_share: float,
    duplicate_label_count: int,
    low_quality_ratio: float,
) -> list[str]:
    reasons: list[str] = []
    if confidence < WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD:
        reasons.append("low_workflow_confidence")
    if components["flow"] < 0.60:
        reasons.append("weak_flow_signature")
    if components["evidence"] < 0.60:
        reasons.append("weak_evidence_support")
    if components["label"] < WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD:
        reasons.append("weak_or_duplicate_label")
    if duplicate_label_count > 1:
        reasons.append("duplicate_label")
    if _is_mixed_residual_reason(split_reason):
        reasons.append("mixed_residual_flow")
    if coverage_share >= 0.25:
        reasons.append("large_coverage_share")
    if low_quality_ratio >= 0.40:
        reasons.append("low_quality_member_share")
    return _dedupe(reasons)


def _sample_review_reason_codes(
    *,
    components: dict[str, float],
    duplicate_label_count: int,
    weak_semantic_boundary_sample: bool = False,
) -> list[str]:
    reasons: list[str] = []
    if duplicate_label_count > 1:
        return []
    label_confidence = components["label"]
    if WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD <= label_confidence < WORKFLOW_LABEL_SAMPLE_REVIEW_THRESHOLD:
        reasons.append("weak_label_sample")
    if weak_semantic_boundary_sample:
        reasons.append("weak_semantic_boundary_sample")
    return reasons


def _review_tier(confidence: float, needs_review: bool, *, has_sample_review: bool = False) -> str:
    if needs_review:
        return "human_review"
    if has_sample_review:
        return "sample_review"
    if confidence >= WORKFLOW_HIGH_CONFIDENCE_THRESHOLD:
        return "high_confidence"
    return "sample_review"


def _is_mixed_residual_reason(split_reason: str) -> bool:
    return split_reason in {"mixed_flow", "mixed_residual"} or split_reason.endswith(
        f"{COMPOUND_SPLIT_SEPARATOR}mixed_residual"
    )


def _workflow_confidence_report(clusters: list[dict[str, Any]]) -> dict[str, Any]:
    if not clusters:
        return {
            "workflowConfidenceAvg": 0.0,
            "workflowConfidenceMin": 0.0,
            "highConfidenceWorkflowCount": 0,
            "reviewRequiredWorkflowCount": 0,
            "reviewRequiredRate": 0.0,
            "lowConfidenceWorkflowCount": 0,
            "duplicateLabelRate": 0.0,
            "maxWorkflowCoverage": 0.0,
            "effectiveWorkflowCount": 0.0,
        }
    confidences = [_float_value(cluster.get("workflow_confidence"), default=0.0) for cluster in clusters]
    review_count = sum(1 for cluster in clusters if cluster.get("needs_human_review") is True)
    low_confidence_count = sum(1 for confidence in confidences if confidence < WORKFLOW_REVIEW_CONFIDENCE_THRESHOLD)
    primary_clusters = [cluster for cluster in clusters if cluster.get("is_novel_outlier_candidate") is not True]
    duplicate_metric_clusters = primary_clusters or clusters
    labels = [_workflow_label(cluster) for cluster in duplicate_metric_clusters]
    duplicate_labels = {label for label, count in Counter(labels).items() if count > 1}
    review_candidate_labels = [
        _workflow_label(cluster) for cluster in clusters if cluster.get("is_novel_outlier_candidate") is True
    ]
    review_candidate_duplicates = {label for label, count in Counter(review_candidate_labels).items() if count > 1}
    review_candidate_duplicate_count = sum(
        1 for label in review_candidate_labels if label in review_candidate_duplicates
    )
    coverage_shares = [_float_value(cluster.get("coverage_share"), default=0.0) for cluster in clusters]
    return {
        "workflowConfidenceAvg": sum(confidences) / len(confidences),
        "workflowConfidenceMin": min(confidences),
        "highConfidenceWorkflowCount": sum(
            1 for cluster in clusters if cluster.get("review_tier") == "high_confidence"
        ),
        "sampleReviewWorkflowCount": sum(1 for cluster in clusters if cluster.get("review_tier") == "sample_review"),
        "reviewRequiredWorkflowCount": review_count,
        "reviewRequiredRate": review_count / len(clusters),
        "lowConfidenceWorkflowCount": low_confidence_count,
        "duplicateLabelRate": sum(1 for label in labels if label in duplicate_labels) / len(labels),
        "reviewCandidateDuplicateLabelRate": (
            review_candidate_duplicate_count / len(review_candidate_labels) if review_candidate_labels else 0.0
        ),
        "maxWorkflowCoverage": max(coverage_shares) if coverage_shares else 0.0,
        "effectiveWorkflowCount": _effective_workflow_count(coverage_shares),
    }


def _effective_workflow_count(coverage_shares: list[float]) -> float:
    denominator = sum(value * value for value in coverage_shares if value > 0.0)
    return (1.0 / denominator) if denominator > 0.0 else 0.0


def _total_member_count(clusters: list[dict[str, Any]]) -> int:
    return sum(len(_string_list(cluster.get("member_conv_ids"))) for cluster in clusters)


def _workflow_label(cluster: dict[str, Any]) -> str:
    return str(cluster.get("canonical_intent") or cluster.get("suggested_name") or "").strip().casefold()


def _confidence(cluster: dict[str, Any]) -> float:
    quality = cluster.get("quality")
    if not isinstance(quality, dict):
        return 0.5
    values = [
        value
        for key in ("interpretability_score", "workflow_consistency_score", "branching_explainability_score")
        if isinstance((value := quality.get(key)), (int, float))
    ]
    return float(sum(values) / len(values)) if values else 0.5


def _float_value(value: object, *, default: float) -> float:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else default


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output


def _read_preprocessed_index(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> dict[str, dict[str, Any]]:
    payload = _read_json(_upstream_stage_dir("preprocessing", runtime_config, stage_context) / "preprocessed_data.json")
    conversations = payload.get("conversations")
    if not isinstance(conversations, list):
        return {}
    index = {str(item["id"]): item for item in conversations if isinstance(item, dict) and "id" in item}
    caselets = payload.get("issueCaselets")
    if isinstance(caselets, list):
        for caselet in caselets:
            if isinstance(caselet, dict) and isinstance(caselet.get("caseletId"), str):
                index[str(caselet["caseletId"])] = {
                    "id": caselet.get("caseletId", ""),
                    "source_conversation_id": caselet.get("conversationId"),
                    "canonical_text": caselet.get("canonicalText", ""),
                    "customer_problem_text": caselet.get("customerIssueText", ""),
                    "ended_status": caselet.get("outcome"),
                    "flow_events": caselet.get("flowEvents", []),
                    "turn_event_details": caselet.get("turnEventDetails", []),
                    "workflow_signal": caselet.get("workflowSignal", {}),
                    "source_quality_flags": caselet.get("sourceQualityFlags", []),
                    "filtered": caselet.get("filtered") is True,
                    "quality_score": caselet.get("qualityScore"),
                    "quality_tier": caselet.get("qualityTier"),
                    "evidence_turn_ids": caselet.get("evidenceTurnIds", []),
                    "action_object_frame": caselet.get("actionObjectFrame", {}),
                }
    return index


def _upstream_stage_dir(stage_name: str, runtime_config: PipelineRuntimeConfig, stage_context: StageContext) -> Path:
    upstream = StageContext(
        dag_id=stage_context.dag_id,
        run_id=stage_context.run_id,
        stage_name=stage_name,
        workspace_id=stage_context.workspace_id,
        dataset_id=stage_context.dataset_id,
        pipeline_job_id=stage_context.pipeline_job_id,
    )
    return upstream.artifact_dir(runtime_config)


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read JSON artifact: {path}") from exc
    if not isinstance(payload, dict):
        raise PipelineStageError(f"JSON artifact must be an object: {path}")
    return cast(dict[str, Any], payload)


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _int_list(value: object) -> list[int]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, int) and not isinstance(item, bool)]


__all__ = ["run"]
