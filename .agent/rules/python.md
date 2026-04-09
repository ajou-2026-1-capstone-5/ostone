## Python (ML Pipeline)

### 코드 스타일

```python
# 함수: snake_case, 동사 + 명사
def ingest_conversations(dataset_path: str) -> Dataset:
    pass

# 클래스: PascalCase, 명사
class IntentClusterer:
    pass

# 상수: UPPER_SNAKE_CASE
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
```

### 함수 설계

```python
# 단일 책임 함수
def preprocess_conversations(
    conversations: list[Conversation],
    config: PreprocessConfig
) -> list[CleanedConversation]:
    """
    상담 로그에서 boilerplate를 제거하고 canonical text를 생성한다.

    Args:
        conversations: 원본 대화 목록
        config: 전처리 설정

    Returns:
        정제된 대화 목록
    """
    cleaned = []
    for conv in conversations:
        text = remove_boilerplate(conv.raw_text, config.boilerplate_patterns)
        canonical = generate_canonical(text)
        cleaned.append(CleanedConversation(id=conv.id, text=canonical))
    return cleaned
```

### DAG 스테이지 패턴

```python
from airflow import DAG
from airflow.operators.python import PythonOperator

def create_preprocessing_stage(dag: DAG) -> PythonOperator:
    """
    전처리 스테이지를 생성한다.

    Args:
        dag: 부모 DAG

    Returns:
        전처리 태스크
    """
    return PythonOperator(
        task_id='preprocessing',
        python_callable=preprocess_conversations,
        dag=dag
    )
```

---

## 참고

- [PEP 8 - Python Style Guide](https://peps.python.org/pep-0008/)
