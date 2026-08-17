from rest_framework.pagination import PageNumberPagination


class BasePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"


class ChatPagination(PageNumberPagination):
    """Pagination for chat messages - 20 per page."""
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class CommentsPagination(PageNumberPagination):
    """Pagination for comments - 10 per page."""
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50
