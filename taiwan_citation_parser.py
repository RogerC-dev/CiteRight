#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台灣法律案號識別與處理模組 (Taiwan Legal Citation Parser)
功能：從文本中識別台灣法律案號，並生成結構化資料

支援的案號格式：
1. 一般法院判決：110年度上字第1234號、109年度訴字第5678號
2. 憲法法庭判決：111年憲判字第13號
3. 大法官解釋：釋字第748號
4. 行政法院判決：110年度判字第456號
5. 智慧財產法院：110年度民專上字第789號
6. 最高法院：110年台上字第1011號
"""

import re
import urllib.parse
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import json


@dataclass
class CitationData:
    """案號資料結構"""
    original_text: str      # 原始案號字串
    year: Optional[int]     # 判決年份
    case_type: str          # 字別（如：上、訴、憲判、釋字）
    case_number: str        # 案號
    court_name: str         # 推測的法院名稱
    case_description: str   # 案件類型描述
    official_url: str       # 官方查詢連結
    citation_type: str      # 案號類型（basic/constitutional/interpretation等）


class TaiwanCitationParser:
    """台灣法律案號解析器"""

    def __init__(self):
        # 完整的正規表示式模式字典
        self.CITATION_PATTERNS = {
            # 一般法院判決：110年度上字第1234號、109年度訴字第5678號
            'basic': re.compile(r'(\d{2,3})\s*年度?\s*([\u4e00-\u9fa5]+?)\s*字\s*第\s*(\d+)\s*號'),

            # 憲法法庭判決：111年憲判字第13號
            'constitutional': re.compile(r'(\d{2,3})\s*年\s*憲判字\s*第\s*(\d+)\s*號'),

            # 大法官解釋：釋字第748號
            'interpretation': re.compile(r'釋字第(\d+)號'),

            # 行政法院判決：110年度判字第456號
            'administrative': re.compile(r'(\d{2,3})\s*年度?\s*(判)\s*字\s*第\s*(\d+)\s*號'),

            # 智慧財產法院：110年度民專上字第789號
            'intellectual': re.compile(r'(\d{2,3})\s*年度?\s*(民專上|刑智上|行專上)\s*字\s*第\s*(\d+)\s*號'),

            # 最高法院：110年台上字第1011號
            'supreme': re.compile(r'(\d{2,3})\s*年\s*(台上|台抗|台非|台再)\s*字\s*第\s*(\d+)\s*號'),

            # 高等法院：110年度上字第234號、110年度抗字第567號
            'appellate': re.compile(r'(\d{2,3})\s*年度?\s*(上|抗|更|重上)\s*字\s*第\s*(\d+)\s*號'),

            # 地方法院刑事：110年度易字第890號、110年度重訴字第123號
            'district_criminal': re.compile(r'(\d{2,3})\s*年度?\s*(易|簡|重訴|訴緝|矚)\s*字\s*第\s*(\d+)\s*號'),

            # 地方法院民事：110年度重訴字第456號、110年度訴字第789號
            'district_civil': re.compile(r'(\d{2,3})\s*年度?\s*(重訴|訴|簡上|調)\s*字\s*第\s*(\d+)\s*號')
        }

        # 案件類型對應表
        self.CASE_TYPE_MAPPING = {
            # 最高法院
            '台上': '最高法院上訴審',
            '台抗': '最高法院抗告審',
            '台非': '最高法院非常上訴',
            '台再': '最高法院再審',

            # 高等法院
            '上': '高等法院上訴審',
            '抗': '高等法院抗告審',
            '更': '高等法院更審',
            '重上': '高等法院重大刑案上訴',

            # 地方法院刑事
            '易': '地方法院易科罰金案件',
            '簡': '地方法院簡易判決',
            '重訴': '地方法院重大刑事案件',
            '訴緝': '地方法院通緝案件',
            '矚': '地方法院矚目案件',

            # 地方法院民事
            '訴': '地方法院民事訴訟',
            '簡上': '地方法院簡易程序上訴',
            '調': '地方法院調解案件',

            # 行政法院
            '判': '行政法院判決',

            # 智慧財產法院
            '民專上': '智慧財產法院民事上訴',
            '刑智上': '智慧財產法院刑事上訴',
            '行專上': '智慧財產法院行政上訴',

            # 特殊類型
            '憲判': '憲法法庭判決',
            '釋字': '大法官解釋'
        }

        # 法院名稱推測規則
        self.COURT_MAPPING = {
            '台上': '最高法院',
            '台抗': '最高法院',
            '台非': '最高法院',
            '台再': '最高法院',
            '上': '高等法院',
            '抗': '高等法院',
            '更': '高等法院',
            '重上': '高等法院',
            '判': '高等行政法院',
            '民專上': '智慧財產法院',
            '刑智上': '智慧財產法院',
            '行專上': '智慧財產法院',
            '憲判': '憲法法庭',
            '釋字': '司法院大法官'
        }

    def parse_text(self, text: str) -> List[CitationData]:
        """
        解析文本中的所有台灣法律案號

        Args:
            text: 要解析的文本內容

        Returns:
            List[CitationData]: 找到的所有案號資料列表
        """
        citations = []

        for pattern_type, regex in self.CITATION_PATTERNS.items():
            matches = regex.finditer(text)

            for match in matches:
                citation_data = self._parse_match(match, pattern_type)
                if citation_data:
                    citations.append(citation_data)

        # 去除重複項目（基於原始文本）
        seen_texts = set()
        unique_citations = []
        for citation in citations:
            if citation.original_text not in seen_texts:
                seen_texts.add(citation.original_text)
                unique_citations.append(citation)

        return unique_citations

    def _parse_match(self, match: re.Match, pattern_type: str) -> Optional[CitationData]:
        """
        解析單個正規表示式匹配結果

        Args:
            match: 正規表示式匹配物件
            pattern_type: 模式類型

        Returns:
            CitationData: 解析後的案號資料，如果解析失敗則返回 None
        """
        groups = match.groups()
        original_text = match.group(0)

        try:
            if pattern_type == 'interpretation':
                # 大法官解釋：釋字第748號
                case_number = groups[0]
                return CitationData(
                    original_text=original_text,
                    year=None,
                    case_type='釋字',
                    case_number=case_number,
                    court_name='司法院大法官',
                    case_description='大法官解釋',
                    official_url=self._build_url('interpretation', None, '釋字', case_number),
                    citation_type='interpretation'
                )

            elif pattern_type == 'constitutional':
                # 憲法法庭判決：111年憲判字第13號
                year, case_number = groups
                return CitationData(
                    original_text=original_text,
                    year=int(year),
                    case_type='憲判',
                    case_number=case_number,
                    court_name='憲法法庭',
                    case_description='憲法法庭判決',
                    official_url=self._build_url('constitutional', year, '憲判', case_number),
                    citation_type='constitutional'
                )

            else:
                # 其他所有類型：year, case_type, case_number
                year, case_type, case_number = groups
                court_name = self._infer_court_name(case_type, pattern_type)
                case_description = self.CASE_TYPE_MAPPING.get(case_type, f'{case_type}字案件')

                return CitationData(
                    original_text=original_text,
                    year=int(year),
                    case_type=case_type,
                    case_number=case_number,
                    court_name=court_name,
                    case_description=case_description,
                    official_url=self._build_url('general', year, case_type, case_number),
                    citation_type=pattern_type
                )

        except (ValueError, IndexError) as e:
            print(f"解析案號時發生錯誤: {original_text}, 錯誤: {e}")
            return None

    def _infer_court_name(self, case_type: str, pattern_type: str) -> str:
        """
        根據案件類型推測法院名稱

        Args:
            case_type: 案件字別
            pattern_type: 模式類型

        Returns:
            str: 推測的法院名稱
        """
        # 優先使用精確對應
        if case_type in self.COURT_MAPPING:
            return self.COURT_MAPPING[case_type]

        # 根據模式類型推測
        if pattern_type == 'supreme':
            return '最高法院'
        elif pattern_type == 'appellate':
            return '高等法院'
        elif pattern_type == 'administrative':
            return '高等行政法院'
        elif pattern_type == 'intellectual':
            return '智慧財產法院'
        elif pattern_type in ['district_criminal', 'district_civil']:
            return '地方法院'
        else:
            return '地方法院'  # 預設值

    def _build_url(self, url_type: str, year: Optional[int], case_type: str, case_number: str) -> str:
        """
        構建官方查詢 URL

        Args:
            url_type: URL 類型
            year: 年份
            case_type: 案件類型
            case_number: 案號

        Returns:
            str: 官方查詢 URL
        """
        if url_type == 'interpretation':
            # 大法官解釋查詢
            query = f"釋字第{case_number}號"
            return f"https://law.moj.gov.tw/api/Ch/Law/json?kw={urllib.parse.quote(query)}"

        elif url_type == 'constitutional':
            # 憲法法庭判決查詢
            query = f"{year}年憲判字第{case_number}號"
            return f"https://opendata.judicial.gov.tw/api/v1/judgments?year={year}&category=憲判&number={case_number}"

        else:
            # 一般案件查詢（司法院檢索系統）
            if year:
                query = f"{year}年度{case_type}字第{case_number}號"
            else:
                query = f"{case_type}字第{case_number}號"

            encoded_query = urllib.parse.quote(query)
            return f"https://law.judicial.gov.tw/FJUD/data.aspx?q={encoded_query}"

    def to_json(self, citations: List[CitationData], indent: int = 2) -> str:
        """
        將案號資料轉換為 JSON 格式

        Args:
            citations: 案號資料列表
            indent: JSON 縮排空格數

        Returns:
            str: JSON 格式的字串
        """
        data = [asdict(citation) for citation in citations]
        return json.dumps(data, ensure_ascii=False, indent=indent)

    def to_html_links(self, text: str) -> str:
        """
        將文本中的案號轉換為可點擊的 HTML 連結

        Args:
            text: 原始文本

        Returns:
            str: 包含 HTML 連結的文本
        """
        citations = self.parse_text(text)
        result_text = text

        # 按照出現位置倒序排列，避免替換時位置偏移
        citations.sort(key=lambda x: text.find(x.original_text), reverse=True)

        for citation in citations:
            link_html = f'<a href="{citation.official_url}" target="_blank" class="legal-citation" title="{citation.case_description}">{citation.original_text}</a>'
            result_text = result_text.replace(citation.original_text, link_html)

        return result_text


def main():
    """主函數 - 演示用法"""

    # 測試文本
    sample_text = """
    根據最高法院110年度台上字第1234號判決，以及司法院大法官釋字第748號解釋，
    本案應參考111年憲判字第13號憲法法庭判決。另外，智慧財產法院110年度民專上字第789號判決
    及高等法院109年度上字第456號判決亦值得參考。地方法院108年度訴字第5678號民事判決
    與107年度易字第9012號刑事判決則涉及相關爭議。
    """

    print("=== 台灣法律案號識別與處理模組 演示 ===\n")
    print("輸入文本:")
    print(sample_text)
    print("\n" + "="*60 + "\n")

    # 創建解析器
    parser = TaiwanCitationParser()

    # 解析案號
    citations = parser.parse_text(sample_text)

    print(f"找到 {len(citations)} 個法律案號:\n")

    # 顯示解析結果
    for i, citation in enumerate(citations, 1):
        print(f"{i}. 案號: {citation.original_text}")
        print(f"   年份: {citation.year or '不適用'}")
        print(f"   字別: {citation.case_type}")
        print(f"   案號: {citation.case_number}")
        print(f"   法院: {citation.court_name}")
        print(f"   類型: {citation.case_description}")
        print(f"   查詢: {citation.official_url}")
        print()

    # JSON 格式輸出
    print("JSON 格式輸出:")
    print(parser.to_json(citations))
    print()

    # HTML 連結格式
    print("HTML 連結格式:")
    html_output = parser.to_html_links(sample_text)
    print(html_output)


if __name__ == "__main__":
    main()
